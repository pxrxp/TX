import { AudioEngine } from './audio.js';
import { NetworkManager } from './network.js';

// Landing DOM
const landingView = document.getElementById('station-landing-view');
const callsignInput = document.getElementById('callsign-input');
const roomInput = document.getElementById('room-input');
const randomizeBtn = document.getElementById('randomize-btn');
const connectBtn = document.getElementById('connect-btn');
const landingError = document.getElementById('landing-error');

// Active Deck DOM
const activeView = document.getElementById('wire-active-view');
const telegraphKeyBed = document.getElementById('telegraph-key-bed');

// Channel Hubs & Callsigns
const ROOMS = ['wire-01', 'wire-02', 'atlantic-line', 'relay-nord', 'brass-loop', 'main-hub'];
const PREFIXES = ['stn', 'spark', 'brass', 'wire', 'relay', 'dash', 'key', 'signal'];

function randomCallsign() {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${prefix}-${num}`;
}

callsignInput.value = randomCallsign();
roomInput.value = ROOMS[0];

randomizeBtn.addEventListener('click', () => {
  const current = roomInput.value;
  const choices = ROOMS.filter(r => r !== current);
  roomInput.value = choices[Math.floor(Math.random() * choices.length)];
});

// Audio & State
const audio = new AudioEngine(650);
const peerAudio = new AudioEngine(550);

let myCallsign = callsignInput.value;

// Network Initialization
const network = new NetworkManager(
  (action) => {
    if (action === 'DOWN') {
      peerAudio.startTone();
      document.body.classList.add('key-pressed');
    } else if (action === 'UP') {
      peerAudio.stopTone();
      document.body.classList.remove('key-pressed');
    }
  },
  (senderCallsign, rawMorse, decoded) => { }
);

// Telegraph Key Handlers
let isKeyDown = false;

function handleDown(e) {
  if (document.activeElement.tagName === 'INPUT') return;

  if (e.type === 'keydown' && (e.code !== 'Space' || e.repeat)) return;
  if (e.type === 'keydown') e.preventDefault();
  if (isKeyDown) return;

  isKeyDown = true;
  audio.startTone();
  document.body.classList.add('key-pressed');
  network.sendSignal('DOWN', myCallsign);
}

function handleUp(e) {
  if (document.activeElement.tagName === 'INPUT') return;
  if (e.type === 'keyup' && e.code !== 'Space') return;
  if (!isKeyDown) return;

  isKeyDown = false;
  audio.stopTone();
  document.body.classList.remove('key-pressed');
  network.sendSignal('UP', myCallsign);
}

// Station Connect & Validation
connectBtn.addEventListener('click', async () => {
  const chosenCallsign = callsignInput.value.trim().toLowerCase() || 'stn-74';
  const targetChannel = roomInput.value.trim().toLowerCase() || 'wire-01';

  landingError.classList.add('hidden');
  landingError.innerText = '';

  audio.init();
  network.connect();

  const available = await network.checkCallsignAvailability(targetChannel, chosenCallsign);

  if (!available) {
    landingError.innerText = `callsign "${chosenCallsign}" is already taken in ${targetChannel}`;
    landingError.classList.remove('hidden');
    return;
  }

  myCallsign = chosenCallsign;
  network.joinRoom(targetChannel, myCallsign);

  landingView.classList.add('hidden');
  activeView.classList.remove('hidden');
  activeView.classList.add('flex');
});

// Event Bindings
window.addEventListener('keydown', handleDown);
window.addEventListener('keyup', handleUp);

telegraphKeyBed.addEventListener('pointerdown', (e) => { e.preventDefault(); handleDown(e); });
window.addEventListener('pointerup', () => { if (isKeyDown) handleUp({ type: 'keyup', code: 'Space' }); });
