export const MORSE_DICT = {
  ".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E",
  "..-.": "F", "--.": "G", "....": "H", "..": "I", ".---": "J",
  "-.-": "K", ".-..": "L", "--": "M", "-.": "N", "---": "O",
  ".--.": "P", "--.-": "Q", ".-.": "R", "...": "S", "-": "T",
  "..-": "U", "...-": "V", ".--": "W", "-..-": "X", "-.--": "Y",
  "--..": "Z", "-----": "0", ".----": "1", "..---": "2",
  "...--": "3", "....-": "4", ".....": "5", "-....": "6",
  "--...": "7", "---..": "8", "----.": "9", "/": " "
};

export class MorseDecoder {
  constructor(onUpdate, onAutoSend) {
    this.onUpdate = onUpdate;
    this.onAutoSend = onAutoSend;
    this.accumulatedTokens = [];
    this.currentSymbolBuffer = "";
    this.pressStartTime = 0;
    this.spaceTimeout = null;
    this.wordTimeout = null;
    this.autoSendTimeout = null;
    this.autoSendDelay = 2000; // Default: 2.0s
    this.wpm = 18;
  }

  setWPM(wpm) {
    this.wpm = parseInt(wpm, 10);
  }

  setAutoSendDelay(ms) {
    this.autoSendDelay = parseInt(ms, 10);
    clearTimeout(this.autoSendTimeout);
  }

  keyDown() {
    this.pressStartTime = Date.now();
    clearTimeout(this.spaceTimeout);
    clearTimeout(this.wordTimeout);
    clearTimeout(this.autoSendTimeout);
  }

  keyUp() {
    const duration = Date.now() - this.pressStartTime;
    const dotThreshold = Math.min(Math.max((1200 / this.wpm) * 1.5, 120), 280);
    const symbol = duration < dotThreshold ? "." : "-";
    this.currentSymbolBuffer += symbol;
    this.notify();

    this.spaceTimeout = setTimeout(() => {
      if (this.currentSymbolBuffer.length > 0) {
        this.accumulatedTokens.push(this.currentSymbolBuffer);
        this.currentSymbolBuffer = "";
        this.notify();
      }
    }, 350);

    this.wordTimeout = setTimeout(() => {
      if (this.accumulatedTokens.length > 0 && this.accumulatedTokens[this.accumulatedTokens.length - 1] !== "/") {
        this.accumulatedTokens.push("/");
        this.notify();
      }
    }, 950);

    if (this.autoSendDelay > 0) {
      this.autoSendTimeout = setTimeout(() => {
        if (this.hasContent()) {
          this.onAutoSend();
        }
      }, this.autoSendDelay);
    }
  }

  notify() {
    const tokens = [...this.accumulatedTokens];
    if (this.currentSymbolBuffer) tokens.push(this.currentSymbolBuffer);

    const rawMorse = tokens.join(" ");
    const decoded = tokens.map(t => MORSE_DICT[t] || "?").join("").toLowerCase();

    this.onUpdate(rawMorse, decoded);
  }

  hasContent() {
    return this.accumulatedTokens.length > 0 || this.currentSymbolBuffer.length > 0;
  }

  clear() {
    this.accumulatedTokens = [];
    this.currentSymbolBuffer = "";
    clearTimeout(this.spaceTimeout);
    clearTimeout(this.wordTimeout);
    clearTimeout(this.autoSendTimeout);
    this.notify();
  }

  flushAndGet() {
    const tokens = [...this.accumulatedTokens];
    if (this.currentSymbolBuffer) tokens.push(this.currentSymbolBuffer);
    this.clear();
    const rawMorse = tokens.join(" ");
    const decoded = tokens.map(t => MORSE_DICT[t] || "?").join("").toLowerCase();
    return { rawMorse, decoded };
  }
}