import {createResonanceScene} from '../src/index.js';

const statusEl = document.getElementById('status');
const startBtn = document.getElementById('start');

let context;
let scene;
let source;
let oscillator;
let animationId;
let phase = 0;

function setStatus(text) {
  statusEl.textContent = text;
}

function startDemo() {
  if (context) {
    return;
  }

  context = new AudioContext();
  scene = createResonanceScene(context, {ambisonicOrder: 1});
  scene.output.connect(context.destination);

  source = scene.createSource();
  source.setPosition(1, 0, -1);

  oscillator = context.createOscillator();
  oscillator.type = 'sawtooth';
  oscillator.frequency.value = 220;
  oscillator.connect(source.input);
  oscillator.start();

  const animate = () => {
    phase += 0.02;
    const x = Math.cos(phase) * 2;
    const z = Math.sin(phase) * 2 - 1.5;
    source.setPosition(x, 0, z);
    animationId = requestAnimationFrame(animate);
  };
  animate();

  startBtn.disabled = true;
  setStatus('Running: moving oscillator around listener.');
}

startBtn.addEventListener('click', async () => {
  startDemo();
  if (context.state === 'suspended') {
    await context.resume();
  }
});
