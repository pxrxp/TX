export class AudioEngine {
  constructor(frequency = 650) {
    this.frequency = frequency;
    this.ctx = null;
    this.osc = null;
    this.gainNode = null;
    this.isMuted = false;
    this.isActive = false;
  }

  init() {
    if (this.ctx) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();

    this.osc = this.ctx.createOscillator();
    this.gainNode = this.ctx.createGain();

    this.osc.type = 'sine';
    this.osc.frequency.setValueAtTime(this.frequency, this.ctx.currentTime);

    this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);

    this.osc.connect(this.gainNode);
    this.gainNode.connect(this.ctx.destination);
    this.osc.start();
  }

  setFrequency(freq) {
    this.frequency = freq;
    if (this.osc && this.ctx) {
      this.osc.frequency.setTargetAtTime(this.frequency, this.ctx.currentTime, 0.005);
    }
  }

  startTone() {
    if (this.isMuted) return;
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.gainNode.gain.setValueAtTime(0.18, this.ctx.currentTime);
    this.isActive = true;
  }

  stopTone() {
    if (!this.ctx || !this.isActive) return;

    this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    this.isActive = false;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted && this.isActive) {
      this.stopTone();
    }
    return this.isMuted;
  }
}
