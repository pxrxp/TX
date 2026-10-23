import { AudioEngine } from './audio.js';
import { MorseDecoder } from './morse.js';
import { NetworkManager } from './network.js';

const landingView = document.getElementById('station-landing-view');
const callsignInput = document.getElementById('callsign-input');
const roomInput = document.getElementById('room-input');
const randomizeBtn = document.getElementById('randomize-btn');
const connectBtn = document.getElementById('connect-btn');
const landingError = document.getElementById('landing-error');

const activeView = document.getElementById('wire-active-view');
const chatStream = document.getElementById('chat-stream');
const morseBuffer = document.getElementById('morse-buffer');
const decodedLiveRow = document.getElementById('decoded-live-row');
const decodedLive = document.getElementById('decoded-live');
const clearBtn = document.getElementById('clear-btn');
const sendBtn = document.getElementById('send-btn');
const telegraphKeyBed = document.getElementById('telegraph-key-bed');

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

const audio = new AudioEngine(650);
const peerAudio = new AudioEngine(550);

let myCallsign = callsignInput.value;
let timeFormat = 'UTC';
let showTranslation = true;

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
  (senderCallsign, rawMorse, decoded) => {
    appendMessage(senderCallsign, rawMorse, decoded);
  }
);

const decoder = new MorseDecoder(
  (raw, decoded) => {
    morseBuffer.innerText = raw;
    decodedLive.innerText = decoded;
  },
  () => transmitMessage()
);

function formatMessageTime() {
  const d = new Date();
  if (timeFormat === 'LOCAL') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }
  return d.toISOString().substring(11, 19) + ' utc';
}

function appendMessage(sender, rawMorse, decoded) {
  const timeStr = formatMessageTime();
  const isSelf = sender === myCallsign || sender === 'you';

  const msgDiv = document.createElement('div');
  msgDiv.className = `teleprinter-line flex flex-col ${isSelf ? 'items-end ml-auto text-right' : 'items-start'} gap-1`;
  msgDiv.innerHTML = `
    <div class="flex items-center gap-2 text-[11px] font-mono tracking-wider text-[#636a77]">
      <span class="${isSelf ? 'text-[#ffbe44]' : 'text-[#f0f2f5]'} font-sans font-black text-xs tracking-wider">${sender}</span>
      <span>·</span>
      <span class="text-[#717a89] font-mono text-[11px] font-semibold tracking-wider">${timeStr}</span>
    </div>
    <div class="font-mono font-bold text-xs sm:text-[13px] tracking-[0.28em] ${isSelf ? 'text-[#ffbe44]/80' : 'text-[#555c68]'} select-all leading-relaxed">${rawMorse}</div>
    <div class="decoded-text-line font-sans font-extrabold text-[20px] sm:text-[22px] tracking-tight ${isSelf ? 'text-[#ffbe44]' : 'text-[#f0f2f5]'} leading-snug" style="display: ${showTranslation ? 'block' : 'none'};">${decoded}</div>
  `;

  chatStream.appendChild(msgDiv);
  chatStream.scrollTop = chatStream.scrollHeight;
}

function transmitMessage() {
  const { rawMorse, decoded } = decoder.flushAndGet();
  if (!decoded.trim()) return;

  appendMessage(myCallsign, rawMorse, decoded);
  network.sendMessage(myCallsign, rawMorse, decoded);
}

let isKeyDown = false;

function handleDown(e) {
  if (document.activeElement.tagName === 'INPUT') return;

  if (e.type === 'keydown' && (e.code !== 'Space' || e.repeat)) return;
  if (e.type === 'keydown') e.preventDefault();
  if (isKeyDown) return;

  isKeyDown = true;
  audio.startTone();
  document.body.classList.add('key-pressed');
  decoder.keyDown();
  network.sendSignal('DOWN', myCallsign);
}

function handleUp(e) {
  if (document.activeElement.tagName === 'INPUT') return;
  if (e.type === 'keyup' && e.code !== 'Space') return;
  if (!isKeyDown) return;

  isKeyDown = false;
  audio.stopTone();
  document.body.classList.remove('key-pressed');
  decoder.keyUp();
  network.sendSignal('UP', myCallsign);
}

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

window.addEventListener('keydown', handleDown);
window.addEventListener('keyup', handleUp);

telegraphKeyBed.addEventListener('pointerdown', (e) => { e.preventDefault(); handleDown(e); });
window.addEventListener('pointerup', () => { if (isKeyDown) handleUp({ type: 'keyup', code: 'Space' }); });

clearBtn.addEventListener('click', () => {
  decoder.clear();
});

sendBtn.addEventListener('click', () => transmitMessage());
