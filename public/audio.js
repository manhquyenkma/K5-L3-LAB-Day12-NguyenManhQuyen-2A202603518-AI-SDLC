// Hệ thống âm thanh thuần Web Audio API (1 AudioContext, không file ngoài).
// Hỗ trợ nhạc nền đêm, 10 hiệu ứng SFX theo TICKET-02 Phần 3 và điều chỉnh âm lượng.
export class AudioEngine {
  constructor(volume = 0.7) {
    this.ctx = null;
    this.master = null;
    this.volume = volume;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.litCount = 0;
    this.activeVoices = 0;
    this.maxVoices = 12;
  }

  _ensure() {
    if (this.volume <= 0) return false;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    } catch {
      return false;
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    }
    if (this.volume <= 0) this.stopBgm();
  }

  setLitCount(n) {
    this.litCount = Math.max(0, n | 0);
  }

  _tone(freq, dur = 0.14, type = 'sine', gain = 0.12, endFreq = null) {
    if (!this._ensure() || this.activeVoices >= this.maxVoices) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
    g.gain.setValueAtTime(Math.max(0.0001, gain), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g).connect(this.master);
    this.activeVoices++;
    osc.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 1); };
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }

  startBgm() {
    if (this.bgmTimer || this.volume <= 0) return;
    // Thang ngũ cung êm dịu ban đêm (D4, E4, G4, A4, B4, D5, E5)
    const scale = [293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25];
    this.bgmTimer = setInterval(() => {
      if (this.volume <= 0 || !this._ensure()) return;
      const idx = this.bgmStep++ % scale.length;
      // Nốt trầm nền
      this._tone(146.83, 1.35, 'sine', 0.045);
      // Giai điệu nhẹ
      this._tone(scale[idx], 0.9, 'triangle', 0.03);
    }, 1500);
  }

  stopBgm() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  // 10 hiệu ứng âm thanh bắt buộc theo TICKET-02 Phần 3:
  playPickup(carried = 1) { this._tone(580 + carried * 45, 0.1, 'sine', 0.12, 820 + carried * 45); }
  playDeposit() { this._tone(440, 0.16, 'triangle', 0.14, 587); }
  playLanternLit() {
    this._tone(523.25, 0.25, 'triangle', 0.16);
    setTimeout(() => this._tone(659.25, 0.28, 'triangle', 0.16), 90);
    setTimeout(() => this._tone(783.99, 0.42, 'sine', 0.18), 180);
  }
  playPulse() { this._tone(480, 0.34, 'sine', 0.18, 180); }
  playHit() { this._tone(150, 0.3, 'sawtooth', 0.16, 65); }
  playJump() { this._tone(260, 0.14, 'sine', 0.12, 520); }
  playDash() { this._tone(700, 0.15, 'triangle', 0.14, 240); }
  playShadeSpawn() { this._tone(120, 0.45, 'sawtooth', 0.09, 85); }
  playCountdown(sec) { this._tone(sec <= 3 ? 920 : 720, 0.11, 'square', 0.08); }
  playWindWarn() { this._tone(220, 0.65, 'sine', 0.07, 340); }
  playCharm() {
    this._tone(659.25, 0.15, 'sine', 0.14);
    setTimeout(() => this._tone(987.77, 0.28, 'sine', 0.15), 80);
  }
  playWin() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => this._tone(f, 0.35, 'triangle', 0.16), i * 110));
  }
  playLose() {
    [330, 277, 220, 165].forEach((f, i) => setTimeout(() => this._tone(f, 0.32, 'sawtooth', 0.11), i * 130));
  }
}
