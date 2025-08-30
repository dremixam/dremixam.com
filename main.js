import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

const container = document.getElementById("col1");
var audioEnabled = false;
var timeout;
var lastAudio = "";

const WelcomeAudio = 'audio/welcome.ogg';
const RandomAudio = ['audio/2.ogg', 'audio/3.ogg', 'audio/4.ogg', 'audio/5.ogg', 'audio/6.ogg', 'audio/7.ogg', 'audio/8.ogg', 'audio/9.ogg', 'audio/10.ogg', 'audio/10.ogg', 'audio/12.ogg', 'audio/13.ogg', 'audio/14.ogg', 'audio/15.ogg', 'audio/16.ogg', 'audio/17.ogg', 'audio/18.ogg', 'audio/19.ogg', 'audio/20.ogg', 'audio/21.ogg', 'audio/22.ogg', 'audio/23.ogg', 'audio/24.ogg', 'audio/25.ogg', 'audio/26.ogg', 'audio/27.ogg', 'audio/28.ogg', 'audio/29.ogg', 'audio/30.ogg', 'audio/31.ogg', 'audio/32.ogg', 'audio/33.ogg'];

const clock = new THREE.Clock();
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(10, container.offsetWidth / container.offsetHeight, 10, 50);
camera.position.z = 20;

const horizontalFov = 10;

camera.fov = (Math.atan(Math.tan(((horizontalFov / 2) * Math.PI) / 180) / camera.aspect) * 2 * 180) / Math.PI;
camera.updateProjectionMatrix();

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    alpha: true // Permet la transparence
});

renderer.setClearColor(0x000000, 0); // Fond transparent
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.offsetWidth, container.offsetHeight);
renderer.setAnimationLoop(animate);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

container.appendChild(renderer.domElement);

const loader = new GLTFLoader();

new RGBELoader()
    .setPath('textures/')
    .load('workshop.hdr', function (texture) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
    });


var leon;
var leftFan, rightFan, eye;
var basePosition = { x: 0, y: 0, z: 0 };
var baseRotation = { x: .3, y: .4, z: 0 };

loader.load('/leon.glb', function (gltf) {
    leon = gltf.scene.getObjectByName('Leon');
    leftFan = gltf.scene.getObjectByName('FansLeft');
    rightFan = gltf.scene.getObjectByName('FansRight');
    eye = gltf.scene.getObjectByName('Eye');

    eye.material.emissive = new THREE.Color("hsl(203, 60%, 50%)");
    eye.material.emissiveIntensity = 0;

    scene.add(gltf.scene);
});

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(-.5, .7, 1).normalize();
scene.add(light);

scene.add(new THREE.AmbientLight(0xffffff, 1));

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
        bumpRobot(intersects[0].point); // Passe le point d'intersection à la fonction

        var button = document.getElementById("audioToggle");
        if (!audioEnabled) {
            button.classList.remove("bi-volume-mute-fill");
            button.classList.add("bi-volume-up-fill");
            audioEnabled = true;
            playAudioVoice(WelcomeAudio);
        }
    }


});

let oscillations = []; // Tableau pour stocker les oscillations

function addOscillation(direction, intensity, duration, speed) {
    oscillations.push({
        direction, // { x, y, z } : direction de l'oscillation
        intensity, // Intensité initiale de l'oscillation
        duration, // Durée totale de l'oscillation
        speed, // Vitesse de l'oscillation
        elapsed: 0 // Temps écoulé pour cette oscillation
    });
}

function bumpRobot(intersectPoint) {
    if (!leon) return;

    // Calculer la direction de la bousculade en fonction du point d'intersection
    const localPoint = leon.worldToLocal(intersectPoint.clone());
    const direction = {
        x: localPoint.y * -0.5, // Plus le clic est haut/bas, plus la rotation en X est grande
        y: localPoint.x * 0.5, // Plus le clic est à gauche/droite, plus la rotation en Y est grande
        z: 0 // Pas de rotation sur l'axe Z pour cette bousculade
    };

    // Ajouter une oscillation de bousculade avec une vitesse aléatoire
    const randomSpeed = Math.random() * 2 + 1; // Vitesse entre 1 et 3
    const randomDuration = Math.random() * 3 + 4; // Durée entre 1 et 3 secondes
    const randomIntensity = Math.random() * 2 + 2; // Intensité entre 1 et 3
    addOscillation(direction, randomIntensity, randomDuration, randomSpeed); // Intensité 2, durée 3 secondes, vitesse aléatoire
}

function animate() {
    const deltaTime = clock.getDelta(); // Temps écoulé depuis la dernière frame
    const elapsedTime = clock.getElapsedTime(); // Temps total écoulé

    // Animation des ventilateurs
    if (rightFan) {
        rightFan.rotation.y = 20 * elapsedTime;
    }
    if (leftFan) {
        leftFan.rotation.y = -20 * elapsedTime;
    }

    // Animation de "léon"
    if (leon) {
        const oscillationX = Math.sin(elapsedTime * 3) * 0.01;
        const oscillationY = Math.sin(elapsedTime * 2) * 0.01;
        const oscillationZ = Math.sin(elapsedTime * 4) * 0.01;

        // Ajouter l'oscillation normale
        let totalRotation = {
            x: baseRotation.x + oscillationX,
            y: baseRotation.y + oscillationY,
            z: baseRotation.z + oscillationZ
        };

        // Mettre à jour les oscillations
        for (let i = oscillations.length - 1; i >= 0; i--) {
            const osc = oscillations[i];
            osc.elapsed += deltaTime; // Met à jour le temps écoulé

            if (osc.elapsed > osc.duration) {
                // Supprimer l'oscillation si elle a expiré
                oscillations.splice(i, 1);
                continue;
            }

            // Calculer l'intensité actuelle (décroît avec le temps)
            const progress = osc.elapsed / osc.duration;
            const currentIntensity = osc.intensity * (1 - progress); // Décroît linéairement

            // Ajouter la contribution de cette oscillation
            totalRotation.x += osc.direction.x * Math.sin(progress * Math.PI * 2 * osc.speed) * currentIntensity;
            totalRotation.y += osc.direction.y * Math.sin(progress * Math.PI * 2 * osc.speed) * currentIntensity;
            totalRotation.z += osc.direction.z * Math.sin(progress * Math.PI * 2 * osc.speed) * currentIntensity;
        }

        // Appliquer la rotation totale
        leon.rotation.set(totalRotation.x, totalRotation.y, totalRotation.z);

        // Oscillation de la position
        leon.position.set(
            basePosition.x,
            basePosition.y + Math.sin(elapsedTime) * 0.5,
            basePosition.z
        );
    }

    // Rendu de la scène
    composer.render();
}

window.onresize = function () {
    camera.aspect = container.offsetWidth / container.offsetHeight;
    camera.fov = (Math.atan(Math.tan(((horizontalFov / 2) * Math.PI) / 180) / camera.aspect) * 2 * 180) / Math.PI;
    camera.updateProjectionMatrix();
    renderer.setSize(container.offsetWidth, container.offsetHeight);
};

document.getElementById("audioToggle").addEventListener('click', function (event) {
    var button = document.getElementById("audioToggle");
    if (audioEnabled) {
        button.classList.remove("bi-volume-up-fill");
        button.classList.add("bi-volume-mute-fill");
        if (timeout) clearTimeout(timeout);
        audioEnabled = false;
    } else {
        button.classList.remove("bi-volume-mute-fill");
        button.classList.add("bi-volume-up-fill");
        audioEnabled = true;
        playAudioVoice(WelcomeAudio);
    }
});

function playAudioVoice(audioSrc) {
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

        if (eye) {
            eye.material.emissiveIntensity = averageVolume / 4;
        }

        if (audioEnabled && !audio.paused) {
            requestAnimationFrame(displayVolume);
        } else if (!audioEnabled && !audio.paused) {
            audio.pause();
            if (eye) {
                eye.material.emissiveIntensity = 0;
            }
        } else if (audioEnabled && audio.paused) {
            if (eye) {
                eye.material.emissiveIntensity = 0;
            }
            timeout = setTimeout(function () {
                if (!audioEnabled) return;
                var randomElement;
                do {
                    randomElement = RandomAudio[Math.floor(Math.random() * RandomAudio.length)];
                } while (lastAudio == randomElement);
                lastAudio = randomElement;
                playAudioVoice(randomElement);
            }, Math.floor(Math.random() * 10000) + 10000);
        }
    }

    audio.play();

    displayVolume();
}

//animate();
