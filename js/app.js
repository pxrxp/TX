import { AudioEngine } from './audio.js';
import { MorseDecoder } from './morse.js';
import { NetworkManager } from './network.js';

// Landing DOM
const landingView = document.getElementById('station-landing-view');
const callsignInput = document.getElementById('callsign-input');
const roomInput = document.getElementById('room-input');
const randomizeBtn = document.getElementById('randomize-btn');
const connectBtn = document.getElementById('connect-btn');
const landingError = document.getElementById('landing-error');
const toggleCipherBtn = document.getElementById('toggle-cipher-btn');

// Active Deck DOM
const activeView = document.getElementById('wire-active-view');
const topMorsePanel = document.getElementById('top-morse-panel');
const settingsPanel = document.getElementById('settings-panel');
const closeCipherBtn = document.getElementById('close-cipher-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const toggleCheat = document.getElementById('toggle-cheat');
const toggleSfx = document.getElementById('toggle-sfx');
const toggleSettings = document.getElementById('toggle-settings');
const sfxIcon = document.getElementById('sfx-icon');
const chatStream = document.getElementById('chat-stream');
const morseBuffer = document.getElementById('morse-buffer');
const decodedLiveRow = document.getElementById('decoded-live-row');
const decodedLive = document.getElementById('decoded-live');
const clearBtn = document.getElementById('clear-btn');
const sendBtn = document.getElementById('send-btn');
const sendTimerTrack = document.getElementById('send-timer-track');
const sendTimerRing = document.getElementById('send-timer-ring');
const telegraphKeyBed = document.getElementById('telegraph-key-bed');

// Settings Controls
const freqSlider = document.getElementById('freq-slider');
const freqVal = document.getElementById('freq-val');
const peerFreqSlider = document.getElementById('peer-freq-slider');
const peerFreqVal = document.getElementById('peer-freq-val');
const wpmSlider = document.getElementById('wpm-slider');
const wpmVal = document.getElementById('wpm-val');
const peerWpmSlider = document.getElementById('peer-wpm-slider');
const peerWpmVal = document.getElementById('peer-wpm-val');
const transmitDelaySlider = document.getElementById('transmit-delay-slider');
const transmitDelayVal = document.getElementById('transmit-delay-val');
const transOnBtn = document.getElementById('trans-on-btn');
const transOffBtn = document.getElementById('trans-off-btn');
const clockUtcBtn = document.getElementById('clock-utc-btn');
const clockLocalBtn = document.getElementById('clock-local-btn');

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
let timeFormat = 'UTC';
let showTranslation = true;
let peerWpm = 18;

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
  (senderCallsign, rawMorse, decoded) => {
    appendMessage(senderCallsign, rawMorse, decoded);
  }
);

// Decoder Setup
const decoder = new MorseDecoder(
  (raw, decoded) => {
    morseBuffer.innerText = raw;
    decodedLive.innerText = decoded;
  },
  () => transmitMessage()
);

// Send Timer Animation
let timerAnim = null;
let timerStart = 0;
const CIRCUMFERENCE = 125.66;

function startTimerRing() {
  resetTimerRing();
  if (decoder.autoSendDelay <= 0) return;

  if (sendTimerTrack) sendTimerTrack.classList.remove('opacity-0');
  timerStart = performance.now();

  function step(now) {
    const elapsed = now - timerStart;
    const progress = Math.min(elapsed / decoder.autoSendDelay, 1.0);
    sendTimerRing.style.strokeDashoffset = CIRCUMFERENCE * (1.0 - progress);

    if (progress < 1.0) {
      timerAnim = requestAnimationFrame(step);
    }
  }
  timerAnim = requestAnimationFrame(step);
}

function resetTimerRing() {
  if (timerAnim) cancelAnimationFrame(timerAnim);
  if (sendTimerTrack) sendTimerTrack.classList.add('opacity-0');
  sendTimerRing.style.strokeDashoffset = CIRCUMFERENCE;
}

function formatMessageTime() {
  const d = new Date();
  if (timeFormat === 'LOCAL') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }
  return d.toISOString().substring(11, 19) + ' utc';
}

function updateTranslationVisibility() {
  if (decodedLiveRow) {
    decodedLiveRow.style.display = showTranslation ? 'flex' : 'none';
  }
  document.querySelectorAll('.decoded-text-line').forEach(el => {
    el.style.display = showTranslation ? 'block' : 'none';
  });
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
  resetTimerRing();
  const { rawMorse, decoded } = decoder.flushAndGet();
  if (!decoded.trim()) return;

  appendMessage(myCallsign, rawMorse, decoded);
  network.sendMessage(myCallsign, rawMorse, decoded);
}

// Telegraph Key Handlers
let isKeyDown = false;

function handleDown(e) {
  if (document.activeElement.tagName === 'INPUT') return;

  if (e.type === 'keydown' && (e.code !== 'Space' || e.repeat)) return;
  if (e.type === 'keydown') e.preventDefault();
  if (isKeyDown) return;

  resetTimerRing();
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

  if (decoder.hasContent()) {
    startTimerRing();
  }
}

// Station Connect & Validation
connectBtn.addEventListener('click', async () => {
  const chosenCallsign = callsignInput.value.trim().toLowerCase() || 'stn-74';
  const targetChannel = roomInput.value.trim().toLowerCase() || 'wire-01';

  landingError.classList.add('hidden');
  landingError.innerText = '';
  connectBtn.disabled = true;

  try {
    audio.init();
    peerAudio.init();

    await network.connect();

    const available = await network.checkCallsignAvailability(targetChannel, chosenCallsign);

    if (!available) {
      landingError.innerText = `callsign "${chosenCallsign}" is already taken in ${targetChannel}`;
      landingError.classList.remove('hidden');
      connectBtn.disabled = false;
      return;
    }

    await network.joinRoom(targetChannel, chosenCallsign);
    myCallsign = chosenCallsign;

    landingView.classList.add('hidden');
    activeView.classList.remove('hidden');
    activeView.classList.add('flex');
  } catch (err) {
    landingError.innerText = 'failed to connect to telegraph broker. please try again.';
    landingError.classList.remove('hidden');
  } finally {
    connectBtn.disabled = false;
  }
});

// Event Bindings
window.addEventListener('keydown', handleDown);
window.addEventListener('keyup', handleUp);

telegraphKeyBed.addEventListener('pointerdown', (e) => { e.preventDefault(); handleDown(e); });
window.addEventListener('pointerup', () => { if (isKeyDown) handleUp({ type: 'keyup', code: 'Space' }); });

clearBtn.addEventListener('click', () => {
  resetTimerRing();
  decoder.clear();
});

sendBtn.addEventListener('click', () => transmitMessage());

// Overlay Menu Handlers
toggleCipherBtn.addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
  topMorsePanel.classList.toggle('hidden');
});

toggleCheat.addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
  topMorsePanel.classList.toggle('hidden');
});

closeCipherBtn.addEventListener('click', () => topMorsePanel.classList.add('hidden'));

toggleSettings.addEventListener('click', () => {
  topMorsePanel.classList.add('hidden');
  settingsPanel.classList.toggle('hidden');
});

closeSettingsBtn.addEventListener('click', () => settingsPanel.classList.add('hidden'));

// Settings Event Bindings
freqSlider.addEventListener('input', (e) => {
  const val = e.target.value;
  freqVal.innerText = `${val} hz`;
  audio.setFrequency(parseInt(val, 10));
});

peerFreqSlider.addEventListener('input', (e) => {
  const val = e.target.value;
  peerFreqVal.innerText = `${val} hz`;
  peerAudio.setFrequency(parseInt(val, 10));
});

wpmSlider.addEventListener('input', (e) => {
  const val = e.target.value;
  wpmVal.innerText = `${val} wpm`;
  decoder.setWPM(val);
});

peerWpmSlider.addEventListener('input', (e) => {
  const val = e.target.value;
  peerWpmVal.innerText = `${val} wpm`;
  peerWpm = parseInt(val, 10);
});

transmitDelaySlider.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  if (val >= 5.5) {
    transmitDelayVal.innerText = 'manual';
    decoder.setAutoSendDelay(0);
  } else {
    transmitDelayVal.innerText = `${val.toFixed(1)}s`;
    decoder.setAutoSendDelay(val * 1000);
  }
});

transOnBtn.addEventListener('click', () => {
  showTranslation = true;
  transOnBtn.className = 'text-[#ffbe44] font-bold transition cursor-pointer lowercase';
  transOffBtn.className = 'text-zinc-400 hover:text-white transition cursor-pointer lowercase';
  updateTranslationVisibility();
});

transOffBtn.addEventListener('click', () => {
  showTranslation = false;
  transOffBtn.className = 'text-[#ffbe44] font-bold transition cursor-pointer lowercase';
  transOnBtn.className = 'text-zinc-400 hover:text-white transition cursor-pointer lowercase';
  updateTranslationVisibility();
});

clockUtcBtn.addEventListener('click', () => {
  timeFormat = 'UTC';
  clockUtcBtn.className = 'text-[#ffbe44] font-bold transition cursor-pointer lowercase';
  clockLocalBtn.className = 'text-zinc-400 hover:text-white transition cursor-pointer lowercase';
});

clockLocalBtn.addEventListener('click', () => {
  timeFormat = 'LOCAL';
  clockLocalBtn.className = 'text-[#ffbe44] font-bold transition cursor-pointer lowercase';
  clockUtcBtn.className = 'text-zinc-400 hover:text-white transition cursor-pointer lowercase';
});

toggleSfx.addEventListener('click', () => {
  const muted = audio.toggleMute();
  toggleSfx.classList.toggle('text-[#686f7c]', muted);
  toggleSfx.classList.toggle('text-[#cbd3de]', !muted);

  if (sfxIcon) {
    if (muted) {
      sfxIcon.innerHTML = `
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <line x1="22" y1="9" x2="16" y2="15"></line>
        <line x1="16" y1="9" x2="22" y2="15"></line>
      `;
    } else {
      sfxIcon.innerHTML = `
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path class="sfx-wave" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        <path class="sfx-wave" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      `;
    }
  }
});
