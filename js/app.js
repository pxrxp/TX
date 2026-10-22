import { AudioEngine } from './audio.js';

// Landing DOM
const callsignInput = document.getElementById('callsign-input');
const roomInput = document.getElementById('room-input');
const randomizeBtn = document.getElementById('randomize-btn');
const telegraphKeyBed = document.getElementById('telegraph-key-bed');

// Channel Hubs & Callsigns
const ROOMS = ['wire-01', 'wire-02', 'atlantic-line', 'relay-nord', 'brass-loop', 'main-hub'];
const PREFIXES = ['stn', 'spark', 'brass', 'wire', 'relay', 'dash', 'key', 'signal'];

function randomCallsign() {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${prefix}-${num}`;
}

if (callsignInput && roomInput) {
  callsignInput.value = randomCallsign();
  roomInput.value = ROOMS[0];
}

if (randomizeBtn) {
  randomizeBtn.addEventListener('click', () => {
    const current = roomInput.value;
    const choices = ROOMS.filter(r => r !== current);
    roomInput.value = choices[Math.floor(Math.random() * choices.length)];
  });
}

// Audio Engine Instance
const audio = new AudioEngine(650);
let isKeyDown = false;

function handleDown(e) {
  if (document.activeElement.tagName === 'INPUT') return;
  if (e.type === 'keydown' && (e.code !== 'Space' || e.repeat)) return;
  if (e.type === 'keydown') e.preventDefault();
  if (isKeyDown) return;

  isKeyDown = true;
  audio.startTone();
  document.body.classList.add('key-pressed');
}

function handleUp(e) {
  if (document.activeElement.tagName === 'INPUT') return;
  if (e.type === 'keyup' && e.code !== 'Space') return;
  if (!isKeyDown) return;

  isKeyDown = false;
  audio.stopTone();
  document.body.classList.remove('key-pressed');
}

window.addEventListener('keydown', handleDown);
window.addEventListener('keyup', handleUp);

if (telegraphKeyBed) {
  telegraphKeyBed.addEventListener('pointerdown', (e) => { e.preventDefault(); handleDown(e); });
}
window.addEventListener('pointerup', () => { if (isKeyDown) handleUp({ type: 'keyup', code: 'Space' }); });
