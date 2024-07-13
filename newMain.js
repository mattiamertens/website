import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import openSimplexNoise from 'https://cdn.skypack.dev/open-simplex-noise';

// Create a scene
const scene = new THREE.Scene();
// Set the background color


// Create a camera
const camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.z = 5;


// Create a renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xEBEBEB, 1);

// Disable zooming
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = true;

document.getElementById('canvas').appendChild(renderer.domElement);

const uniforms = {
    u_resolution: {type: 'v2', value: new THREE.Vector2(window.innerWidth, window.innerHeight)},
    u_time: {type: 'f', value: 0.0},
    u_frequency: {type: 'f', value: 0.0}
}

// LIGHTS
// const ambientLight = new THREE.AmbientLight(0xFF0000), 
//     pointLight = new THREE.PointLight(0x00FF00),
//     dl = new THREE.DirectionalLight(0xFF00C8, 1100);
// scene.add(ambientLight, pointLight, dl);
// // pointLight.position.set(0, 4, 0);

// const helper = new THREE.PointLightHelper(pointLight, 5);
// scene.add(helper);
// const helper2 = new THREE.DirectionalLightHelper(dl, 5);
// scene.add(helper2);


// const material = new THREE.ShaderMaterial({
//     uniforms,
//     vertexShader: document.getElementById('vertex').textContent,
//     fragmentShader: document.getElementById('fragment').textContent,
//     wireframe: true
// });
// const geometry = new THREE.IcosahedronGeometry(40, 16);
 
// const mesh = new THREE.Mesh(geometry, material);
// scene.add(mesh);


// GEOMETRY
let sphereGeometry = new THREE.SphereGeometry(3, 162, 162);
sphereGeometry.positionData = [];
let initialDistances = new Float32Array(sphereGeometry.attributes.position.count);
let v3 = new THREE.Vector3();
for (let i = 0; i < sphereGeometry.attributes.position.count; i++){
    v3.fromBufferAttribute(sphereGeometry.attributes.position, i);
    sphereGeometry.positionData.push(v3.clone());
    initialDistances[i] = v3.length(); // Store initial distance
}

// Add initialDistance attribute
sphereGeometry.setAttribute('initialDistance', new THREE.BufferAttribute(initialDistances, 1));

// SHADER MATERIAL
let sphereMesh = new THREE.ShaderMaterial({
    uniforms: {      
        colorA: { value: new THREE.Color(0x000000) },
        colorB: { value: new THREE.Color(0x8DE4F7) },
        u_frequency: {type: 'f', value: 0.0},
        audioData: { value: new Float32Array(32) }
    },
    vertexShader: document.getElementById('v-shad').textContent,
    fragmentShader: document.getElementById('fragmentShader').textContent,
    // wireframe: true
});
let sphere = new THREE.Mesh(sphereGeometry, sphereMesh);
// sphere.scale.set(0.4, 0.4, 0.4);
scene.add(sphere);

const listener = new THREE.AudioListener();
camera.add(listener);

const sound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();
audioLoader.load('assets/despacito.mp3', function(buffer){
    sound.setBuffer(buffer);

    let playing = false;
    window.addEventListener('click', () => {
        if (!playing){
            sound.play();
            playing = true;
        }
        else {
            sound.pause();
            playing = false;
        }
    })
})

const analyser = new THREE.AudioAnalyser(sound, 32);


let noise = openSimplexNoise.makeNoise4D(Date.now());
console.log(noise(1,1,1,1));
let clock = new THREE.Clock();

// Mouse position
let mouse = new THREE.Vector2();
let mouse3D = new THREE.Vector3();
let raycaster = new THREE.Raycaster();
// window.addEventListener('mousemove', (e) => {
//     mouse.x = e.clientX / window.innerWidth;
//     mouse.y = e.clientY / window.innerHeight;
// });
// Add event listener for mouse move
window.addEventListener('mousemove', (event) => {
    // Normalize mouse position to range [-1, 1]
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    // Convert mouse position to 3D
    mouse3D.set(mouse.x, mouse.y, 0);
    mouse3D.unproject(camera);
});

// Function to linearly interpolate between two values
function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}
function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
const transDuration = 0.7;

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    let elapsedTime = clock.getElapsedTime();

    let t = Math.min(elapsedTime / transDuration, 1.0);
    let easedT = easeInOutQuad(t);

    let audioData = analyser.data;
    let avgfrequency = analyser.getAverageFrequency();

    // Update sphere geometry based on audio data
    sphereGeometry.positionData.forEach((p, idx) => {
        let noiseValue = noise(p.x, p.y, p.z, elapsedTime*0.3);
        let audioFactor = audioData[idx % audioData.length] / 256;
        let combinedIn = noiseValue + (audioFactor * 0.001);
        let interpolatedInfluence = easedT * combinedIn;
        //let interpolatedInfluence = lerp(0, combinedIn, t); 
        
        v3.copy(p).addScaledVector(p, interpolatedInfluence * 0.1);
        

        sphereGeometry.attributes.position.setXYZ(idx, v3.x, v3.y, v3.z);
    })
    sphereGeometry.computeVertexNormals();
    sphereGeometry.attributes.position.needsUpdate = true;

    // Update audio data
    sphereMesh.uniforms.audioData.value = audioData;
    uniforms.u_frequency.value = avgfrequency;
    sphere.rotation.y += 0.0004;
    sphere.rotation.x += -0.0004;

    // Update raycaster with mouse position
    raycaster.setFromCamera(mouse, camera);
   
    let direction = mouse3D.clone().sub(sphere.position).normalize();
    sphere.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);

    // Interpolate sphere scale
    let scale = 0.4 + easedT * 0.6;
    sphere.scale.set(scale, scale, scale);


    // Render the scene
    renderer.render(scene, camera);
}


// Make the canvas responsive
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start the animation loopoop
animate();