import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SavePass } from 'three/examples/jsm/postprocessing/SavePass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { resolveBehaviors, updateSpinners, type ResolvedBehaviors } from './leonBehaviors';
import {
    applyDetachableMask,
    applyEmissiveGlow,
    applyFlipbookEye,
    getLeonUniforms,
    setEyeAnimation,
    setEyeColor,
    type LeonBaseColorParams,
    type LeonShaderParams,
} from './leonMaterials';
import { DEFAULT_EYE, MESSAGES, SLEEP_EYE, WELCOME_MESSAGE, type EyeLook, type LeonMessage } from './leonMessages';
import type { Subtitles } from './subtitles';

/** Plus grande dimension du robot, en unités de scène (taille du modèle d'origine). */
const MODEL_SIZE = 2;
const GLOW_INTENSITY = 30;
/** Volume de la voix de Léon, entre 0 et 1. */
const VOICE_VOLUME = 0.8;

/** Passe finale : tone mapping "Neutral" de URP par canal, sortie sRGB et alpha de la scène d'avant le bloom. */
const FinalShader = {
    uniforms: { tDiffuse: { value: null }, tBase: { value: null } },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tBase;
        varying vec2 vUv;

        vec3 neutralCurve( vec3 x ) {
            const float a = 0.2, b = 0.29, c = 0.24, d = 0.272, e = 0.02, f = 0.3;
            return ( ( x * ( a * x + c * b ) + d * e ) / ( x * ( a * x + b ) + d * f ) ) - e / f;
        }

        vec3 unityNeutral( vec3 x ) {
            vec3 whiteScale = vec3( 1.0 ) / neutralCurve( vec3( 5.3 ) );
            return neutralCurve( x * whiteScale ) * whiteScale;
        }

        vec3 linearToSRGB( vec3 c ) {
            return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) );
        }

        void main() {
            vec3 color = clamp( unityNeutral( max( texture2D( tDiffuse, vUv ).rgb, 0.0 ) ), 0.0, 1.0 );
            gl_FragColor = vec4( linearToSRGB( color ), texture2D( tBase, vUv ).a );
        }
    `,
};

export function initLeon(container: HTMLElement, audioToggleButton: HTMLElement, subtitles?: Subtitles) {
    let audioEnabled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let lastMessage: LeonMessage | null = null;

    const clock = new THREE.Clock();
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(10, container.offsetWidth / container.offsetHeight, 10, 50);
    camera.position.z = 20;

    const horizontalFov = 10;
    camera.fov = (Math.atan(Math.tan(((horizontalFov / 2) * Math.PI) / 180) / camera.aspect) * 2 * 180) / Math.PI;
    camera.updateProjectionMatrix();

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        alpha: true,
    });

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    renderer.setAnimationLoop(animate);

    // Rendu dans un buffer HDR linéaire, tone mapping une seule fois à la fin comme dans Unity.
    // Réglages du bloom repris du profil URP du modkit (seuil 1).
    const composer = new EffectComposer(renderer);
    composer.renderTarget1.samples = 4;
    composer.renderTarget2.samples = 4;
    const baseSave = new SavePass();
    const bloom = new UnrealBloomPass(new THREE.Vector2(container.offsetWidth, container.offsetHeight), 0.35, 0.6, 1);
    const final = new ShaderPass(FinalShader);
    final.uniforms.tBase.value = baseSave.renderTarget.texture;
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(baseSave);
    composer.addPass(bloom);
    composer.addPass(final);

    container.appendChild(renderer.domElement);

    new RGBELoader().setPath('/textures/').load('workshop.hdr', (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
    });

    let leon: THREE.Group | null = null;
    let behaviors: ResolvedBehaviors | null = null;
    const shaderMaterials: THREE.Material[] = [];
    const eyeMaterials: THREE.MeshStandardMaterial[] = [];
    let legacyEyeMaterial: THREE.MeshStandardMaterial | null = null;

    const basePosition = { x: 0, y: 0, z: 0 };
    const baseRotation = { x: 0.3, y: 0.4, z: 0 };

    const iconLoader = new THREE.TextureLoader();
    const icons = new Map<string, Promise<THREE.Texture>>();

    function loadIcon(url: string): Promise<THREE.Texture> {
        let icon = icons.get(url);
        if (!icon) {
            icon = iconLoader.loadAsync(url).then((texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.flipY = false;
                return texture;
            });
            icons.set(url, icon);
        }
        return icon;
    }

    new GLTFLoader().load('/leon.glb', async (gltf) => {
        const model = gltf.scene;
        behaviors = resolveBehaviors(model);

        const materials = new Set<THREE.Material>();
        model.traverse((node) => {
            const mesh = node as THREE.Mesh;
            if (!mesh.isMesh) return;
            for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
                materials.add(material);
            }
        });

        for (const material of materials) {
            if (!(material instanceof THREE.MeshStandardMaterial)) continue;

            // Couleur de base translucide sans alphaMode explicite (verre).
            if (material.opacity < 1) {
                material.transparent = true;
                material.depthWrite = false;
            }

            const baseColor = material.userData.leonBaseColor as LeonBaseColorParams | undefined;
            if (baseColor?.detachableMask !== undefined) {
                const mask: THREE.Texture = await gltf.parser.getDependency('texture', baseColor.detachableMask);
                applyDetachableMask(material, mask, baseColor.alphaCutoff ?? 0.5);
            }

            const params = material.userData.leonShader as LeonShaderParams | undefined;
            if (params?.type === 'emissiveGlow') {
                applyEmissiveGlow(material, params, GLOW_INTENSITY);
                shaderMaterials.push(material);
            } else if (params?.type === 'flipbookEye') {
                material.emissiveMap = await loadIcon(DEFAULT_EYE.eyeIcon);
                applyFlipbookEye(material, { ...params, animationGridSize: [1, 1] }, eyeColor(WELCOME_MESSAGE));
                shaderMaterials.push(material);
                eyeMaterials.push(material);
            }
        }

        const legacyEye = behaviors.eye as THREE.Mesh | null;
        if (legacyEye?.isMesh && legacyEye.material instanceof THREE.MeshStandardMaterial && !legacyEye.material.userData.leonShader) {
            legacyEyeMaterial = legacyEye.material;
            legacyEyeMaterial.emissive = eyeColor(WELCOME_MESSAGE);
            legacyEyeMaterial.emissiveIntensity = 0;
        }
        restEye();

        // Centre le modèle dans un pivot et lui donne la taille du modèle d'origine, quelle que soit l'échelle de l'export.
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model, true);
        const size = box.getSize(new THREE.Vector3());
        const scale = MODEL_SIZE / Math.max(size.x, size.y, size.z);
        model.scale.multiplyScalar(scale);
        model.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-scale);

        leon = new THREE.Group();
        leon.add(model);
        scene.add(leon);
    });

    // Éclairage réglé sur un rendu de l'appli de stream.
    const light = new THREE.DirectionalLight(new THREE.Color(1.0, 0.87, 0.7), 4.2);
    light.position.set(-0.3, 1, 0.6).normalize();
    scene.add(light);
    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambient);
    scene.environmentIntensity = 0.6;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    window.addEventListener('click', (event) => {
        if (!leon) return;

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(leon, true);

        if (intersects.length > 0) {
            bumpRobot(intersects[0].point);

            if (!audioEnabled) {
                setAudioEnabled(true);
                playMessage(WELCOME_MESSAGE);
            }
        }
    });

    interface Oscillation {
        direction: { x: number; y: number; z: number };
        intensity: number;
        duration: number;
        speed: number;
        elapsed: number;
    }
    const oscillations: Oscillation[] = [];

    function addOscillation(direction: Oscillation['direction'], intensity: number, duration: number, speed: number) {
        oscillations.push({ direction, intensity, duration, speed, elapsed: 0 });
    }

    function bumpRobot(intersectPoint: THREE.Vector3) {
        if (!leon) return;

        const localPoint = leon.worldToLocal(intersectPoint.clone());
        const direction = {
            x: localPoint.y * -0.5,
            y: localPoint.x * 0.5,
            z: 0,
        };

        const randomSpeed = Math.random() * 2 + 1;
        const randomDuration = Math.random() * 3 + 4;
        const randomIntensity = Math.random() * 2 + 2;
        addOscillation(direction, randomIntensity, randomDuration, randomSpeed);
    }

    function animate() {
        const deltaTime = clock.getDelta();
        const elapsedTime = clock.getElapsedTime();

        if (behaviors) {
            updateSpinners(behaviors.spinners, elapsedTime);
        }

        if (leon) {
            const oscillationX = Math.sin(elapsedTime * 3) * 0.01;
            const oscillationY = Math.sin(elapsedTime * 2) * 0.01;
            const oscillationZ = Math.sin(elapsedTime * 4) * 0.01;

            const totalRotation = {
                x: baseRotation.x + oscillationX,
                y: baseRotation.y + oscillationY,
                z: baseRotation.z + oscillationZ,
            };

            for (let i = oscillations.length - 1; i >= 0; i--) {
                const osc = oscillations[i];
                osc.elapsed += deltaTime;

                if (osc.elapsed > osc.duration) {
                    oscillations.splice(i, 1);
                    continue;
                }

                const progress = osc.elapsed / osc.duration;
                const currentIntensity = osc.intensity * (1 - progress);

                totalRotation.x += osc.direction.x * Math.sin(progress * Math.PI * 2 * osc.speed) * currentIntensity;
                totalRotation.y += osc.direction.y * Math.sin(progress * Math.PI * 2 * osc.speed) * currentIntensity;
                totalRotation.z += osc.direction.z * Math.sin(progress * Math.PI * 2 * osc.speed) * currentIntensity;
            }

            leon.rotation.set(totalRotation.x, totalRotation.y, totalRotation.z);
            leon.position.set(basePosition.x, basePosition.y + Math.sin(elapsedTime) * 0.5, basePosition.z);
        }

        for (const material of shaderMaterials) {
            const uniforms = getLeonUniforms(material);
            if (uniforms) uniforms.uTime.value = elapsedTime;
        }

        composer.render();
    }

    window.addEventListener('resize', () => {
        camera.aspect = container.offsetWidth / container.offsetHeight;
        camera.fov = (Math.atan(Math.tan(((horizontalFov / 2) * Math.PI) / 180) / camera.aspect) * 2 * 180) / Math.PI;
        camera.updateProjectionMatrix();
        renderer.setSize(container.offsetWidth, container.offsetHeight);
        composer.setSize(container.offsetWidth, container.offsetHeight);
    });

    function setAudioEnabled(enabled: boolean) {
        audioEnabled = enabled;
        audioToggleButton.classList.toggle('bi-volume-up-fill', enabled);
        audioToggleButton.classList.toggle('bi-volume-mute-fill', !enabled);
        audioToggleButton.setAttribute('aria-pressed', String(enabled));
        if (!enabled) {
            currentAudio?.pause();
            subtitles?.hide();
        }
        restEye();
    }

    audioToggleButton.addEventListener('click', () => {
        if (audioEnabled) {
            if (timeout) clearTimeout(timeout);
            setAudioEnabled(false);
        } else {
            setAudioEnabled(true);
            playMessage(WELCOME_MESSAGE);
        }
    });

    /** Allume l'œil de 0 (éteint) à 1 (pleine intensité). */
    function setEyeLevel(level: number) {
        for (const material of eyeMaterials) {
            const audioLevel = getLeonUniforms(material)?.uAudioLevel;
            if (audioLevel) audioLevel.value = level;
        }
        if (legacyEyeMaterial) {
            legacyEyeMaterial.emissiveIntensity = level * 16;
        }
    }

    /** Niveau de l'œil d'après le volume moyen de la voix. */
    function setEyeIntensity(averageVolume: number) {
        setEyeLevel(Math.min(1, averageVolume / 64));
    }

    function eyeColor(look: EyeLook): THREE.Color {
        return new THREE.Color(look.eyeColor ?? DEFAULT_EYE.eyeColor).multiplyScalar(look.eyeIntensity ?? DEFAULT_EYE.eyeIntensity);
    }

    let lookId = 0;

    /** Donne à l'œil l'icône, la couleur et l'animation d'un aspect, dès que l'icône est chargée. */
    async function showLook(look: EyeLook): Promise<boolean> {
        const id = ++lookId;
        const icon = await loadIcon(look.eyeIcon ?? DEFAULT_EYE.eyeIcon).catch(() => loadIcon(DEFAULT_EYE.eyeIcon));
        if (id !== lookId) return false;

        const color = eyeColor(look);
        for (const material of eyeMaterials) {
            material.emissiveMap = icon;
            setEyeColor(material, color);
            setEyeAnimation(material, look.eyeGrid ?? DEFAULT_EYE.eyeGrid, look.eyeSpeed ?? DEFAULT_EYE.eyeSpeed);
        }
        legacyEyeMaterial?.emissive.copy(color);
        return true;
    }

    /** Œil au repos : animation de sommeil quand le son est coupé, éteint entre deux répliques. */
    function restEye() {
        if (audioEnabled) {
            setEyeLevel(0);
            return;
        }
        showLook(SLEEP_EYE).then((applied) => {
            if (applied && !audioEnabled) setEyeLevel(1);
        });
    }

    function preloadIcons() {
        for (const message of [WELCOME_MESSAGE, ...MESSAGES, SLEEP_EYE]) {
            if (message.eyeIcon) loadIcon(message.eyeIcon).catch(() => {});
        }
    }

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let currentAudio: HTMLAudioElement | null = null;

    function scheduleNextMessage() {
        timeout = setTimeout(() => {
            if (!audioEnabled) return;
            let message: LeonMessage;
            do {
                message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
            } while (MESSAGES.length > 1 && message === lastMessage);
            lastMessage = message;
            playMessage(message);
        }, Math.floor(Math.random() * 10000) + 10000);
    }

    function playMessage(message: LeonMessage) {
        if (!audioContext) {
            audioContext = new AudioContext();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            // Le volume est appliqué après l'analyseur : l'éclat de l'œil n'en dépend pas.
            const volume = audioContext.createGain();
            volume.gain.value = VOICE_VOLUME;
            analyser.connect(volume).connect(audioContext.destination);
            preloadIcons();
        }
        const meter = analyser!;
        const audio = new Audio(message.audio);
        currentAudio = audio;
        audioContext.createMediaElementSource(audio).connect(meter);
        // requestAnimationFrame est suspendu dans un onglet caché, la fin de la réplique est aussi suivie ici.
        audio.addEventListener('ended', () => subtitles?.hide());
        const dataArray = new Uint8Array(meter.frequencyBinCount);

        function displayVolume() {
            meter.getByteFrequencyData(dataArray);
            const averageVolume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setEyeIntensity(averageVolume);

            if (audioEnabled && !audio.paused) {
                requestAnimationFrame(displayVolume);
                return;
            }
            audio.pause();
            restEye();
            subtitles?.hide();
            if (audioEnabled) scheduleNextMessage();
        }

        showLook(message);
        audioContext.resume();
        audio.play().then(() => {
            subtitles?.show(message.text, audio);
            displayVolume();
        }, restEye);
    }
}
