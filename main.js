import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

const container = document.getElementById("col1");
var audioEnabled = false;
var timeout;
var lastAudio = "";

const WelcomeAudio = 'audio/1.ogg';
const RandomAudio = ['audio/2.ogg', 'audio/3.ogg', 'audio/4.ogg', 'audio/5.ogg', 'audio/6.ogg', 'audio/7.ogg', 'audio/8.ogg', 'audio/9.ogg', 'audio/10.ogg', 'audio/10.ogg', 'audio/12.ogg', 'audio/13.ogg', 'audio/14.ogg', 'audio/15.ogg', 'audio/16.ogg', 'audio/17.ogg', 'audio/18.ogg', 'audio/19.ogg'];

const clock = new THREE.Clock();
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(10, container.offsetWidth / container.offsetHeight, 10, 50);
camera.position.z = 20;

const horizontalFov = 10;

camera.fov = (Math.atan(Math.tan(((horizontalFov / 2) * Math.PI) / 180) / camera.aspect) * 2 * 180) / Math.PI;
camera.updateProjectionMatrix();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });

renderer.setClearColor(0xff585c72);
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

function animate() {
    if (rightFan) {
        rightFan.rotation.y = 20 * clock.elapsedTime;
    }
    if (leftFan) {
        leftFan.rotation.y = -20 * clock.elapsedTime;
    }
    if (leon) {
        leon.position.set(basePosition.x, basePosition.y + Math.sin(clock.getElapsedTime()) * .5, basePosition.z);
        leon.rotation.set(baseRotation.x + Math.sin(clock.getElapsedTime() * 3) * 0.01, baseRotation.y + Math.sin(clock.getElapsedTime() * 2) * 0.01, baseRotation.z + Math.sin(clock.getElapsedTime() * 4) * 0.01);
    }

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

animate();
