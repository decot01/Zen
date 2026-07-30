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

  playEventWhoosh(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(220, t)
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.35)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.1, t + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.42)
  }

  playEventBerserk(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(70, t)
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.5)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.58)
  }

  playEnergyWallsStart(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(140, t)
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.28)
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.55)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.62)
  }

  playEnergyWallHit(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(520, t)
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.14)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.2)

    const click = ctx.createOscillator()
    const clickGain = ctx.createGain()
    click.type = 'square'
    click.frequency.setValueAtTime(880, t)
    clickGain.gain.setValueAtTime(0.0001, t)
    clickGain.gain.exponentialRampToValueAtTime(0.025, t + 0.005)
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    click.connect(clickGain)
    clickGain.connect(this.dest())
    click.start(t)
    click.stop(t + 0.07)
  }

  playShockwaveSpawn(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(68, t)
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.55)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.06)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.62)
  }

  playShockwaveWhoosh(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(240, t)
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.45)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.035, t + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.52)
  }

  playShockwaveImpact(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(90, t)
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.22)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.09, t + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.3)
  }

  /** Rising warn chirp when an enemy begins charging. */
  playChargeWarn(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(180, t)
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.35)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.1, t + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.42)
  }

  /** Punchy blast for Chain Explosion. */
  playExplosion(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime

    const boom = ctx.createOscillator()
    const boomGain = ctx.createGain()
    boom.type = 'sine'
    boom.frequency.setValueAtTime(110, t)
    boom.frequency.exponentialRampToValueAtTime(32, t + 0.35)
    boomGain.gain.setValueAtTime(0.0001, t)
    boomGain.gain.exponentialRampToValueAtTime(0.22, t + 0.02)
    boomGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    boom.connect(boomGain)
    boomGain.connect(this.dest())
    boom.start(t)
    boom.stop(t + 0.42)

    const crack = ctx.createOscillator()
    const crackGain = ctx.createGain()
    crack.type = 'square'
    crack.frequency.setValueAtTime(420, t)
    crack.frequency.exponentialRampToValueAtTime(90, t + 0.12)
    crackGain.gain.setValueAtTime(0.0001, t)
    crackGain.gain.exponentialRampToValueAtTime(0.07, t + 0.01)
    crackGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
    crack.connect(crackGain)
    crackGain.connect(this.dest())
    crack.start(t)
    crack.stop(t + 0.15)
  }

  playSniperStart(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(220, t)
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.4)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.48)
  }

  playSniperSpawn(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(480, t)
    osc.frequency.exponentialRampToValueAtTime(240, t + 0.18)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.24)
  }

  playSniperLock(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(640, t)
    osc.frequency.setValueAtTime(640, t + 0.08)
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.2)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.045, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.24)
  }

  playSniperFire(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(180, t)
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.28)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.1, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.34)

    const hi = ctx.createOscillator()
    const hiGain = ctx.createGain()
    hi.type = 'sine'
    hi.frequency.setValueAtTime(1200, t)
    hi.frequency.exponentialRampToValueAtTime(200, t + 0.12)
    hiGain.gain.setValueAtTime(0.0001, t)
    hiGain.gain.exponentialRampToValueAtTime(0.04, t + 0.005)
    hiGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
    hi.connect(hiGain)
    hiGain.connect(this.dest())
    hi.start(t)
    hi.stop(t + 0.15)
  }

  playPhaseShift(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(160, t)
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.28)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.055, t + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.42)
  }

  /** Distinct gold warning — shorter / higher than red sniper lock. */
  playYellowLaserWarn(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(880, t)
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.12)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.065, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.24)
  }

  playYellowLaserFire(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(520, t)
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.22)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.085, t + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.3)
  }

  playRadarStart(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, t)
    osc.frequency.exponentialRampToValueAtTime(620, t + 0.55)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.04, t + 0.06)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.62)
  }

  playRadarPulse(): void {
    if (this.muted) return
    void this.ensureRunning()
    const ctx = this.getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(720, t)
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.4)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.038, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42)
    osc.connect(gain)
    gain.connect(this.dest())
    osc.start(t)
    osc.stop(t + 0.44)
  }
}
