/**
 * Procedural Web Audio SFX — no asset files.
 * Audio unlocks on first user gesture via ensureRunning().
 */
export class GameAudio {
  private ctx: AudioContext | null = null
  private muted = false
  private master: GainNode | null = null

  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.master) {
      this.master.gain.value = muted ? 0 : 1
    }
  }

  isMuted(): boolean {
    return this.muted
  }

  async ensureRunning(): Promise<void> {
    const ctx = this.getCtx()
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        // Ignore autoplay restrictions until next gesture
      }
    }
  }

  private getCtx(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 1
      this.master.connect(this.ctx.destination)
    }
    return this.ctx
  }

  private dest(): AudioNode {
    this.getCtx()
    return this.master!
  }

  /** Soft short click for collecting a white orb. */
  playCollect(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, t)
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.04)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.09)
  }

  /** Soft, barely-there chime when combo increases. */
  playCombo(level: number): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime
    const freq = 920 + Math.min(level, 5) * 36

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1800
    filter.Q.value = 0.5
    filter.connect(this.dest())

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.04, t + 0.08)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.028, t + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    osc.connect(gain)
    gain.connect(filter)
    osc.start(t)
    osc.stop(t + 0.14)
  }

  /** Deep boom on death. */
  playDeath(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120, t)
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.45)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.52)

    // Filtered noise burst
    const bufferSize = Math.floor(ctx.sampleRate * 0.25)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 400
    const nGain = ctx.createGain()
    nGain.gain.setValueAtTime(0.2, t)
    nGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    noise.connect(filter)
    filter.connect(nGain)
    nGain.connect(this.dest())
    noise.start(t)
    noise.stop(t + 0.3)
  }
}
