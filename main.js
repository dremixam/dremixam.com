import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ClearPass } from 'three/addons/postprocessing/ClearPass.js';

const clock = new THREE.Clock();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(10 * window.innerHeight / window.innerWidth, window.innerWidth / window.innerHeight, 1500, 2500);
camera.position.z = 1750;

const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setClearColor(0xff585c72);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);

const composer = new EffectComposer(renderer);

composer.addPass(new ClearPass());
composer.addPass(new RenderPass(scene, camera));

document.body.appendChild(renderer.domElement);

const loader = new FBXLoader();

var leon;
var leftFan, rightFan;
var basePosition = { x: 0, y: 0, z: 0 };
loader.load('/leon_animated.fbx', function (object) {
    leon = object;

    console.log(leon);

    leftFan = object.getObjectByName('FansLeft');
    rightFan = object.getObjectByName('FansRight');

    console.log(window.innerWidth);

    basePosition.x = - 120;
    basePosition.y = 50;

    resizeLeon();

    leon.rotation.x = .3;
    leon.rotation.y = 0.4;

    scene.add(leon)
});

const light = new THREE.DirectionalLight(0xffffff, 5);
light.position.set(-.5, .7, 1).normalize();
scene.add(light);

scene.add(new THREE.AmbientLight(0xffffff, 1));

function animate() {
    if (rightFan) {
        rightFan.rotation.z += .3;
    }
    if (leftFan) {
        leftFan.rotation.z -= .3;
    }
    if (leon) {
        leon.position.set(basePosition.x, basePosition.y + Math.sin(clock.getElapsedTime()) * 10, basePosition.z);
        leon.rotation.set(.3 + Math.sin(clock.getElapsedTime() * 3) * 0.01, 0.4 + Math.sin(clock.getElapsedTime() * 2) * 0.01, Math.sin(clock.getElapsedTime() * 4) * 0.01);
    }
    composer.render();
}

function resizeLeon() {
    if (leon) {
        if (window.innerWidth > window.innerHeight) {
            const scaleFactor = window.innerWidth * 0.0003;
            leon.scale.set(scaleFactor, scaleFactor, scaleFactor);
            basePosition.x = -100;
            basePosition.y = 50;
        } else {
            const scaleFactor = window.innerWidth * 0.0018;
            leon.scale.set(scaleFactor, scaleFactor, scaleFactor);
            basePosition.x = 0;
            basePosition.y = 100;
        }
    }
}

window.onresize = function () {
    camera.fov = 10 * window.innerHeight / window.innerWidth;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    resizeLeon();
};

animate();