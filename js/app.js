import { AudioEngine } from './audio.js';

const audio = new AudioEngine(650);
const telegraphKeyBed = document.getElementById('telegraph-key-bed');

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
