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
    type LeonBaseColorParams,
    type LeonShaderParams,
} from './leonMaterials';

/** Largest dimension of the robot, in scene units (size of the original model). */
const MODEL_SIZE = 2;
/**
 * HDR eye color, multiplied by the exported _EmissionIntensity. Very high on purpose, like in the app:
 * it has to go through the dark glass and drive the bloom. Almost no red, so the core stays cyan.
 */
const EYE_COLOR = new THREE.Color(0.002, 0.9, 1.0).multiplyScalar(20);
/** Icon shown on the eye screen (the app picks it at runtime, the export only has the default one). */
const EYE_ICON = '/textures/leon-eye.png';
const GLOW_INTENSITY = 30;

/**
 * Final pass: URP "Neutral" tone mapping (per channel, unlike three's NeutralToneMapping which
 * crushes dark saturated colors), sRGB output, and the scene alpha from before the bloom so the
 * glow adds light over the page instead of drawing a dark box.
 */
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

export function initLeon(container: HTMLElement, audioToggleButton: HTMLElement) {
    let audioEnabled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let lastAudio = '';

    const WelcomeAudio = '/audio/welcome.ogg';
    const RandomAudio = Array.from({ length: 33 }, (_, i) => `/audio/${i + 1}.ogg`);

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

    // Render in a linear HDR buffer and tone map once at the end (like Unity): otherwise each
    // object is tone mapped before blending, and the dark eye glass crushes the emissive screen.
    // Bloom settings follow the modkit's URP profile (threshold 1).
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
    let legacyEyeMaterial: THREE.MeshStandardMaterial | null = null;

    const basePosition = { x: 0, y: 0, z: 0 };
    const baseRotation = { x: 0.3, y: 0.4, z: 0 };

    const eyeIcon = new THREE.TextureLoader().load(EYE_ICON, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        texture.needsUpdate = true;
    });

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

            // Translucent base color without an explicit alphaMode (glass).
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
                material.emissiveMap = eyeIcon;
                applyFlipbookEye(material, { ...params, animationGridSize: [1, 1] }, EYE_COLOR);
                shaderMaterials.push(material);
            }
        }

        const legacyEye = behaviors.eye as THREE.Mesh | null;
        if (legacyEye?.isMesh && legacyEye.material instanceof THREE.MeshStandardMaterial && !legacyEye.material.userData.leonShader) {
            legacyEyeMaterial = legacyEye.material;
            legacyEyeMaterial.emissive = EYE_COLOR.clone();
            legacyEyeMaterial.emissiveIntensity = 0;
        }

        // Exports come in arbitrary units: center the model in a pivot and give it the same
        // size on screen as the original model, whatever the export scale.
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

    // Calibrated on a render from the stream app: strong warm light from above, weak ambient,
    // reflections doing most of the work on the metal parts (the grey albedo turns warm beige).
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
                audioToggleButton.classList.remove('bi-volume-mute-fill');
                audioToggleButton.classList.add('bi-volume-up-fill');
                audioEnabled = true;
                playAudioVoice(WelcomeAudio);
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

    audioToggleButton.addEventListener('click', () => {
        if (audioEnabled) {
            audioToggleButton.classList.remove('bi-volume-up-fill');
            audioToggleButton.classList.add('bi-volume-mute-fill');
            if (timeout) clearTimeout(timeout);
            audioEnabled = false;
        } else {
            audioToggleButton.classList.remove('bi-volume-mute-fill');
            audioToggleButton.classList.add('bi-volume-up-fill');
            audioEnabled = true;
            playAudioVoice(WelcomeAudio);
        }
    });

    function setEyeIntensity(value: number) {
        for (const material of shaderMaterials) {
            const audioLevel = getLeonUniforms(material)?.uAudioLevel;
            if (audioLevel) audioLevel.value = Math.min(1, value / 64);
        }
        if (legacyEyeMaterial) {
            legacyEyeMaterial.emissiveIntensity = value / 4;
        }
    }

    function playAudioVoice(audioSrc: string) {
        const audioContext = new AudioContext();
        const audio = new Audio(audioSrc);
        const source = audioContext.createMediaElementSource(audio);
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        function displayVolume() {
            analyser.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((a, b) => a + b, 0);
            const averageVolume = sum / bufferLength;

            setEyeIntensity(averageVolume);

            if (audioEnabled && !audio.paused) {
                requestAnimationFrame(displayVolume);
            } else if (!audioEnabled && !audio.paused) {
                audio.pause();
                setEyeIntensity(0);
            } else if (audioEnabled && audio.paused) {
                setEyeIntensity(0);
                timeout = setTimeout(() => {
                    if (!audioEnabled) return;
                    let randomElement: string;
                    do {
                        randomElement = RandomAudio[Math.floor(Math.random() * RandomAudio.length)];
                    } while (lastAudio === randomElement);
                    lastAudio = randomElement;
                    playAudioVoice(randomElement);
                }, Math.floor(Math.random() * 10000) + 10000);
            }
        }

        audio.play();
        displayVolume();
    }
}
