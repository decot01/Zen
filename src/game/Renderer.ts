import { COLORS, ENEMY, EVENTS, PLAYER, PRIZE_ORB } from './constants'
import type { Enemy } from './Enemy'
import type { EventVisuals } from './events/EventContext'
import type { Orb } from './Orb'
import type { ParticleSystem } from './Particles'
import type { Player } from './Player'
import { clamp, easeOutBack, easeOutCubic } from '@/utils/math'

export class Renderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private width = 0
  private height = 0
  private dpr = 1

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    this.ctx = ctx
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.width = cssWidth
    this.height = cssHeight
    this.dpr = dpr
    this.canvas.width = Math.max(1, Math.floor(cssWidth * dpr))
    this.canvas.height = Math.max(1, Math.floor(cssHeight * dpr))
    this.canvas.style.width = `${cssWidth}px`
    this.canvas.style.height = `${cssHeight}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height }
  }

  render(
    player: Player,
    orbs: readonly Orb[],
    enemies: readonly Enemy[],
    particles: ParticleSystem,
    options: {
      showPlayer: boolean
      dimmed?: boolean
      worldAlpha?: number
      events?: EventVisuals | null
    } = { showPlayer: true },
  ): void {
    const ctx = this.ctx
    const shake = particles.getShakeOffset()
    const worldAlpha = clamp(options.worldAlpha ?? 1, 0, 1)
    const events = options.events ?? null

    ctx.save()
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, this.width, this.height)

    ctx.translate(shake.x, shake.y)

    this.drawAmbient()

    if (events?.radar) {
      this.drawRadarDarkness(events.radar)
    }

    if (events?.shockwave) {
      this.drawShockwaveEvent(events.shockwave)
    }

    if (events?.sniper) {
      this.drawSniperLasers(events.sniper)
    }
    if (events?.crossfire) {
      this.drawSniperLasers(events.crossfire, 1.2)
    }
    if (events?.bulletHell) {
      this.drawSniperLasers(events.bulletHell, 1.25)
    }

    for (const orb of orbs) {
      if (orb.alive) this.drawWhiteOrb(orb)
    }

    for (const enemy of enemies) {
      if (enemy.alive) this.drawEnemy(enemy)
    }

    if (events?.sniper) {
      this.drawSniperDrones(events.sniper)
    }
    if (events?.crossfire) {
      this.drawSniperDrones(events.crossfire)
    }
    if (events?.bulletHell) {
      this.drawSniperDrones(events.bulletHell)
    }

    // Soft blackout of the playfield (orbs/enemies) while death FX keep playing.
    if (worldAlpha < 0.999) {
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - worldAlpha})`
      ctx.fillRect(-shake.x, -shake.y, this.width, this.height)
    }

    this.drawParticles(particles)

    if (options.showPlayer) {
      this.drawPlayerTrail(player)
      this.drawPlayer(player)
    }

    this.drawShockwaves(particles)
    this.drawPopups(particles)

    if (particles.flash > 0) {
      ctx.fillStyle = `rgba(250, 250, 250, ${0.22 * particles.flash})`
      ctx.fillRect(-shake.x, -shake.y, this.width, this.height)
    }

    // Radar pulse rings (darkness is drawn earlier with entities).
    if (events?.radar) {
      this.drawRadarPulses(events.radar)
    }

    if (options.dimmed) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fillRect(-shake.x, -shake.y, this.width, this.height)
    }

    ctx.restore()

    if (events?.chainExplosion && events.chainExplosion.vignette > 0.01) {
      this.drawChainExplosionVignette(events.chainExplosion.vignette)
    }

    // Screen-fixed frame so shake never leaves a black gap at the edges.
    if (events?.energyWalls) {
      this.drawEnergyWalls(events.energyWalls)
    }
  }

  private drawChainExplosionVignette(strength: number): void {
    const ctx = this.ctx
    const g = ctx.createRadialGradient(
      this.width * 0.5,
      this.height * 0.5,
      Math.min(this.width, this.height) * 0.28,
      this.width * 0.5,
      this.height * 0.5,
      Math.hypot(this.width, this.height) * 0.62,
    )
    g.addColorStop(0, 'rgba(0, 0, 0, 0)')
    g.addColorStop(0.55, `rgba(40, 0, 0, ${0.08 * strength})`)
    g.addColorStop(1, `rgba(0, 0, 0, ${0.55 * strength})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, this.width, this.height)
  }

  private drawEnergyWalls(
    walls: NonNullable<EventVisuals['energyWalls']>,
  ): void {
    const ctx = this.ctx
    const { x, y, w, h, intensity, time, impact } = walls
    const baseT = EVENTS.energyWalls.borderThickness
    const openDur = EVENTS.energyWalls.openDuration
    const maxJerk = EVENTS.energyWalls.impactOffset

    // Soft open (easeOutBack) + fade-linked settle — matches UI motion weight.
    const rawOpen = clamp(time / openDur, 0, 1)
    const open = easeOutBack(rawOpen)
    const settle = easeOutCubic(intensity)
    const maxInset = Math.min(w, h) * 0.38
    const inset = (1 - clamp(open, 0, 1) * settle) * maxInset

    const breathe = 0.92 + Math.sin(time * 2.15) * 0.08
    const thickPulse = 1 + Math.sin(time * 2.15) * 0.05
    const a = Math.min(1, settle * breathe * (0.4 + 0.6 * clamp(open, 0, 1)))
    const t = Math.max(
      1,
      baseT * easeOutCubic(clamp(open, 0, 1)) * thickPulse * (0.85 + 0.15 * settle),
    )

    const rx = x + inset
    const ry = y + inset
    const rw = Math.max(t * 2, w - inset * 2)
    const rh = Math.max(t * 2, h - inset * 2)

    // Bounce jerk: hit side punches inward then springs back.
    const jerk = (v: number) => Math.sin(clamp(v, 0, 1) * Math.PI) * maxJerk
    const jL = jerk(impact.left)
    const jR = jerk(impact.right)
    const jT = jerk(impact.top)
    const jB = jerk(impact.bottom)
    const hit =
      Math.max(impact.left, impact.right, impact.top, impact.bottom)

    const left = rx + t / 2 + jL
    const right = rx + rw - t / 2 - jR
    const top = ry + t / 2 + jT
    const bottom = ry + rh - t / 2 - jB

    ctx.save()
    ctx.strokeStyle = a >= 0.999 ? '#ffffff' : `rgba(255, 255, 255, ${a})`
    ctx.lineWidth = t * (1 + hit * 0.35)
    ctx.lineJoin = 'miter'
    ctx.miterLimit = 2
    if (hit > 0.05) {
      ctx.shadowColor = `rgba(255, 255, 255, ${0.14 * hit * a})`
      ctx.shadowBlur = 2 + hit * 4
    }
    ctx.beginPath()
    ctx.moveTo(left, top)
    ctx.lineTo(right, top)
    ctx.lineTo(right, bottom)
    ctx.lineTo(left, bottom)
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
  }

  private drawShockwaveEvent(
    sw: NonNullable<EventVisuals['shockwave']>,
  ): void {
    const ctx = this.ctx
    const a = Math.min(1, sw.intensity)

    for (const wave of sw.waves) {
      // Flat 2D stripe — crisp line + thin uniform wash (no volumetric gradient).
      ctx.save()
      ctx.globalAlpha = a

      if (wave.edge === 'top' || wave.edge === 'bottom') {
        const y = wave.pos
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
        ctx.fillRect(0, y - 4, this.width, 8)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(this.width, y)
        ctx.stroke()
      } else {
        const x = wave.pos
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
        ctx.fillRect(x - 4, 0, 8, this.height)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, this.height)
        ctx.stroke()
      }

      ctx.restore()
    }
  }

  private drawSniperLasers(
    sn: NonNullable<
      EventVisuals['sniper'] | EventVisuals['crossfire'] | EventVisuals['bulletHell']
    >,
    glowMul = 1,
  ): void {
    const ctx = this.ctx
    const a = Math.min(1, sn.intensity)
    if (a < 0.02) return

    for (const laser of sn.lasers) {
      const { x1, y1, x2, y2 } = laser.line
      const pulse = laser.warningPulse
      const locked = laser.phase === 'locked'
      const firing = laser.phase === 'firing'
      const yellow = laser.tint === 'yellow'
      const core = firing
        ? 0.95
        : locked
          ? 0.55 + pulse * 0.35
          : 0.25 + pulse * 0.35
      const glow =
        (firing ? 14 + laser.fireFlash * 18 : locked ? 8 : 5) *
        glowMul *
        (yellow ? 1.25 : 1)

      ctx.save()
      ctx.globalAlpha = a * (0.55 + core * 0.45)

      ctx.strokeStyle = firing
        ? yellow
          ? `rgba(255, 245, 180, ${0.4 + laser.fireFlash * 0.5})`
          : `rgba(255, 220, 220, ${0.35 + laser.fireFlash * 0.5})`
        : yellow
          ? `rgba(250, 200, 40, ${0.25 + pulse * 0.3})`
          : `rgba(255, 80, 80, ${0.2 + pulse * 0.25})`
      ctx.lineWidth = firing ? 10 * glowMul * (yellow ? 1.1 : 1) : locked ? 6 : 4
      ctx.shadowColor = yellow ? '#fbbf24' : '#ff3333'
      ctx.shadowBlur = glow
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()

      ctx.shadowBlur = glow * 0.4
      ctx.strokeStyle = firing
        ? '#ffffff'
        : yellow
          ? locked
            ? `rgba(255, 230, 120, ${0.75 + pulse * 0.25})`
            : `rgba(250, 204, 70, ${0.45 + pulse * 0.4})`
          : locked
            ? `rgba(255, 180, 180, ${0.7 + pulse * 0.3})`
            : `rgba(255, 120, 120, ${0.4 + pulse * 0.4})`
      ctx.lineWidth = firing ? 2.5 + laser.fireFlash * 2 : locked ? 1.75 : 1.15
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()

      ctx.restore()
    }
  }

  private drawSniperDrones(
    sn: NonNullable<
      EventVisuals['sniper'] | EventVisuals['crossfire'] | EventVisuals['bulletHell']
    >,
  ): void {
    const ctx = this.ctx
    const a = Math.min(1, sn.intensity)
    const size = EVENTS.sniper.droneSize

    for (const d of sn.drones) {
      if (d.appear < 0.02) continue
      const yellow = d.tint === 'yellow'
      ctx.save()
      ctx.translate(d.x, d.y)
      ctx.globalAlpha = a * d.appear

      ctx.shadowColor = yellow ? '#f59e0b' : '#ff2222'
      ctx.shadowBlur = yellow ? 14 : 10
      ctx.fillStyle = '#1a1a1a'
      ctx.strokeStyle = yellow ? '#fbbf24' : '#ff5555'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, -size)
      ctx.lineTo(size * 0.85, 0)
      ctx.lineTo(0, size)
      ctx.lineTo(-size * 0.85, 0)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      ctx.shadowBlur = yellow ? 16 : 12
      ctx.shadowColor = yellow ? '#facc15' : '#ff0000'
      ctx.fillStyle = yellow ? '#fbbf24' : '#ff3333'
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.28, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.shadowBlur = 0
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.1, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()
    }
  }

  private drawRadarDarkness(
    radar: NonNullable<EventVisuals['radar']>,
  ): void {
    const ctx = this.ctx
    const dark = radar.darkness
    if (dark < 0.02) return

    const px = radar.playerX
    const py = radar.playerY
    const maxR = Math.hypot(this.width, this.height)
    const hole = PLAYER.radius * 2.4

    ctx.save()
    const g = ctx.createRadialGradient(px, py, hole * 0.25, px, py, maxR)
    g.addColorStop(0, 'rgba(0, 0, 0, 0)')
    g.addColorStop(hole / maxR, `rgba(0, 0, 0, ${dark * 0.45})`)
    g.addColorStop(Math.min(0.55, (hole * 3) / maxR), `rgba(0, 0, 0, ${dark * 0.92})`)
    g.addColorStop(1, `rgba(0, 0, 0, ${dark})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, this.width, this.height)
    ctx.restore()
  }

  private drawRadarPulses(
    radar: NonNullable<EventVisuals['radar']>,
  ): void {
    const ctx = this.ctx
    const a = Math.min(1, radar.intensity)
    if (a < 0.02 || radar.pulses.length === 0) return

    ctx.save()
    for (const pulse of radar.pulses) {
      const alpha = pulse.alpha * a
      if (alpha < 0.02) continue

      // Soft green wash behind the front
      const band = ctx.createRadialGradient(
        pulse.x,
        pulse.y,
        Math.max(0, pulse.radius - 22),
        pulse.x,
        pulse.y,
        pulse.radius + 2,
      )
      band.addColorStop(0, 'rgba(80, 220, 120, 0)')
      band.addColorStop(0.7, `rgba(70, 210, 110, ${0.05 * alpha})`)
      band.addColorStop(1, 'rgba(80, 220, 120, 0)')
      ctx.globalAlpha = 1
      ctx.fillStyle = band
      ctx.beginPath()
      ctx.arc(pulse.x, pulse.y, pulse.radius + 2, 0, Math.PI * 2)
      ctx.fill()

      ctx.globalAlpha = alpha * 0.7
      ctx.strokeStyle = '#4ade80'
      ctx.lineWidth = 1.8
      ctx.shadowColor = '#22c55e'
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2)
      ctx.stroke()

      ctx.globalAlpha = alpha * 0.28
      ctx.strokeStyle = '#bbf7d0'
      ctx.lineWidth = 1
      ctx.shadowBlur = 4
      ctx.beginPath()
      ctx.arc(pulse.x, pulse.y, Math.max(1, pulse.radius - 5), 0, Math.PI * 2)
      ctx.stroke()
      ctx.shadowBlur = 0
    }
    ctx.restore()
  }

  private drawAmbient(): void {
    const ctx = this.ctx
    const g = ctx.createRadialGradient(
      this.width * 0.5,
      this.height * 0.4,
      0,
      this.width * 0.5,
      this.height * 0.5,
      Math.max(this.width, this.height) * 0.65,
    )
    g.addColorStop(0, 'rgba(250, 250, 250, 0.03)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, this.width, this.height)
  }

  private drawPlayerTrail(player: Player): void {
    const ctx = this.ctx
    const trail = player.getTrail()
    const n = trail.length
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / n
      const p = trail[i]!
      const r = player.radius * 0.35 * t
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(250, 250, 250, ${0.14 * t})`
      ctx.fill()
    }
  }

  private drawPlayer(player: Player): void {
    const ctx = this.ctx
    const pulse = player.pulse
    const stretch = player.stretch
    const r = player.radius * pulse

    ctx.save()
    ctx.translate(player.x, player.y)
    ctx.rotate(player.heading)
    ctx.scale(1 + stretch, 1 - stretch * 0.55)

    // Soft canvas glow — Apple Intelligence palette.
    // Base a bit stronger; shimmer + bloom ramp with combo.
    const palette = [
      [0xbc, 0x82, 0xf3],
      [0xf5, 0xb9, 0xea],
      [0x8d, 0x9f, 0xff],
      [0xff, 0x67, 0x78],
      [0xff, 0xba, 0x71],
      [0xc6, 0x86, 0xff],
    ] as const
    const comboT = clamp(player.comboGlow / 9, 0, 1)
    const shimmerSpeed = 0.07 + comboT * 0.12
    const t = player.time * shimmerSpeed
    const i = Math.floor(t) % palette.length
    const j = (i + 1) % palette.length
    const f = t - Math.floor(t)
    const a = palette[i]!
    const b = palette[j]!
    const rr = Math.round(a[0] + (b[0] - a[0]) * f)
    const gg = Math.round(a[1] + (b[1] - a[1]) * f)
    const bb = Math.round(a[2] + (b[2] - a[2]) * f)
    const dprScale = this.dpr > 1.5 ? 0.95 : 0.72
    const blurScale = 1.2 + comboT * 0.28

    ctx.shadowColor = `rgb(${rr}, ${gg}, ${bb})`
    ctx.shadowBlur = PLAYER.glowBlur * dprScale * blurScale

    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.white
    ctx.fill()

    // Subtle extra wash at higher combo.
    if (comboT > 0.15) {
      ctx.shadowBlur = PLAYER.glowBlur * dprScale * (0.55 + comboT * 0.35)
      ctx.shadowColor = `rgba(${rr}, ${gg}, ${bb}, ${0.2 + comboT * 0.2})`
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }

  private drawWhiteOrb(orb: Orb): void {
    const ctx = this.ctx
    const scale = orb.scale
    const r = Math.max(0.5, orb.radius * scale)
    const dim = orb.radarDim
    const rev = orb.radarReveal
    // Between scans: fully hidden (no silhouettes — harder than Blackout lamp).
    if (dim > 0.05 && rev < 0.08) return
    const alpha = orb.alpha
    const prize = orb.kind === 'prize'

    ctx.save()
    ctx.translate(orb.x, orb.y)

    const ring = orb.appearRing
    if (ring) {
      ctx.shadowBlur = 0
      ctx.beginPath()
      ctx.arc(0, 0, ring.radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(250, 250, 250, ${ring.alpha})`
      ctx.lineWidth = 1.5 * (1 - orb.spawnProgress * 0.5)
      ctx.stroke()
    }

    if (prize) {
      const palette = [
        [0xbc, 0x82, 0xf3],
        [0xf5, 0xb9, 0xea],
        [0x8d, 0x9f, 0xff],
        [0xff, 0x67, 0x78],
        [0xff, 0xba, 0x71],
        [0xc6, 0x86, 0xff],
      ] as const
      const t = orb.time * 0.35
      const i = Math.floor(t) % palette.length
      const j = (i + 1) % palette.length
      const f = t - Math.floor(t)
      const ca = palette[i]!
      const cb = palette[j]!
      const rr = Math.round(ca[0] + (cb[0] - ca[0]) * f)
      const gg = Math.round(ca[1] + (cb[1] - ca[1]) * f)
      const bb = Math.round(ca[2] + (cb[2] - ca[2]) * f)
      const dprScale = this.dpr > 1.5 ? 1 : 0.78
      const lifeBoost = 0.75 + orb.lifeRatio * 0.45

      // Soft outer bloom
      ctx.globalAlpha = alpha * 0.55
      ctx.shadowColor = `rgba(${rr}, ${gg}, ${bb}, 0.9)`
      ctx.shadowBlur = PRIZE_ORB.glowBlur * 1.65 * dprScale * lifeBoost
      ctx.beginPath()
      ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${rr}, ${gg}, ${bb}, 0.35)`
      ctx.fill()

      // Mid bloom
      ctx.globalAlpha = alpha * 0.75
      ctx.shadowBlur = PRIZE_ORB.glowBlur * dprScale * lifeBoost
      ctx.beginPath()
      ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, 0.45)`
      ctx.fill()

      // Soft life ring
      ctx.shadowBlur = 0
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(
        0,
        0,
        r * 1.7,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * orb.lifeRatio,
      )
      ctx.strokeStyle = `rgba(${rr}, ${gg}, ${bb}, ${0.55 * alpha})`
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Core
      ctx.shadowColor = `rgb(${rr}, ${gg}, ${bb})`
      ctx.shadowBlur = PRIZE_ORB.glowBlur * 0.7 * dprScale
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fillStyle = '#FFFFFF'
      ctx.fill()
    } else {
      ctx.shadowBlur = 0
      ctx.shadowColor = 'rgba(255,255,255,0.85)'
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fillStyle = '#FFFFFF'
      ctx.fill()
    }

    ctx.restore()
  }

  private drawEnemy(enemy: Enemy): void {
    const ctx = this.ctx
    const charging = enemy.charging
    const cp = enemy.chargeProgress
    const phased = enemy.phaseAmount
    const dim = enemy.radarDim
    const rev = enemy.radarReveal
    // Between scans: fully hidden (no silhouettes — harder than Blackout lamp).
    if (dim > 0.05 && rev < 0.08) return
    const scale = enemy.scale * enemy.pulse * (1 + phased * 0.06)
    const r = enemy.radius * scale
    const alpha = enemy.alpha
    const glowMul = enemy.berserk
      ? EVENTS.berserk.glowMul
      : charging
        ? 1.4 + cp * 2.2
        : phased > 0.05
          ? 1.2 + phased * 1.4
          : 1
    const flash =
      charging && Math.sin(enemy.age * (14 + cp * 22)) > 0.15 ? 1 : 0
    const phaseGlow = phased > 0.05

    ctx.save()
    ctx.translate(enemy.x, enemy.y)
    ctx.globalAlpha = alpha

    ctx.shadowColor = charging
      ? flash
        ? '#ffaaaa'
        : '#ff3333'
      : phaseGlow
        ? '#8b5cf6'
        : enemy.berserk
          ? '#ff4444'
          : enemy.armed
            ? COLORS.white
            : COLORS.danger
    ctx.shadowBlur =
      (enemy.armed || charging || phaseGlow
        ? ENEMY.glowBlur * 0.7
        : ENEMY.glowBlur * 0.35) * glowMul

    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = charging
      ? flash
        ? '#7a2020'
        : '#4a1010'
      : phaseGlow
        ? `rgba(${Math.round(40 + phased * 20)}, ${Math.round(30 + phased * 40)}, ${Math.round(70 + phased * 80)}, ${0.35 + phased * 0.25})`
        : enemy.berserk
          ? '#5c1515'
          : enemy.armed
            ? COLORS.dangerDark
            : 'rgba(63, 63, 70, 0.55)'
    ctx.fill()

    ctx.shadowBlur = 0
    ctx.lineWidth =
      enemy.armed || enemy.berserk || charging || phaseGlow ? 2.2 : 1.5
    ctx.strokeStyle = charging
      ? flash
        ? '#ffffff'
        : '#ff6b6b'
      : phaseGlow
        ? `rgba(${Math.round(120 + phased * 80)}, ${Math.round(140 + phased * 60)}, 250, ${0.55 + phased * 0.4})`
        : enemy.berserk
          ? '#ff6b6b'
          : enemy.armed
            ? COLORS.white
            : COLORS.danger
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()

    if (phased > 0.08 && phased < 0.95) {
      const rip = 1.2 + (1 - Math.abs(phased - 0.5) * 2) * 0.35
      ctx.globalAlpha = alpha * (0.25 + (1 - Math.abs(phased - 0.5) * 2) * 0.4)
      ctx.strokeStyle = '#a78bfa'
      ctx.lineWidth = 1.25
      ctx.beginPath()
      ctx.arc(0, 0, r * rip, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = alpha
    }

    ctx.beginPath()
    ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2)
    ctx.fillStyle = phaseGlow
      ? `rgba(180, 200, 255, ${0.4 + phased * 0.5})`
      : enemy.armed || enemy.berserk || charging
        ? COLORS.white
        : 'rgba(250, 250, 250, 0.35)'
    ctx.fill()

    if (!enemy.armed && !charging) {
      ctx.globalAlpha = 0.3 + enemy.armProgress * 0.45
      ctx.strokeStyle = COLORS.white
      ctx.lineWidth = 1.25
      ctx.beginPath()
      ctx.arc(0, 0, r * (1.45 + (1 - enemy.armProgress) * 0.55), 0, Math.PI * 2)
      ctx.stroke()
    }

    // Charge: blast-radius preview + accelerating blink.
    if (charging) {
      const blastR = EVENTS.chainExplosion.blastRadius
      const blinkHz = 2.5 + cp * 8
      const blink = 0.5 + 0.5 * Math.sin(enemy.age * Math.PI * 2 * blinkHz)
      const ringA = (0.18 + cp * 0.55) * (0.4 + blink * 0.6)

      ctx.globalAlpha = alpha * ringA
      ctx.strokeStyle = flash ? '#ffffff' : '#ff8a8a'
      ctx.lineWidth = 1.5 + cp * 2
      ctx.beginPath()
      ctx.arc(0, 0, blastR, 0, Math.PI * 2)
      ctx.stroke()

      ctx.globalAlpha = alpha * (0.04 + cp * 0.14) * blink
      ctx.fillStyle = '#ff4444'
      ctx.beginPath()
      ctx.arc(0, 0, blastR, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }

  private drawParticles(system: ParticleSystem): void {
    const ctx = this.ctx
    for (const p of system.getParticles()) {
      const t = clamp(p.life / p.maxLife, 0, 1)
      ctx.globalAlpha = t
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.6), 0, Math.PI * 2)
      ctx.fillStyle = p.color
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private drawShockwaves(system: ParticleSystem): void {
    const ctx = this.ctx
    for (const s of system.shockwaves) {
      if (s.age < 0) continue
      const t = clamp(s.age / s.duration, 0, 1)
      const radius = s.maxRadius * t
      if (s.kind === 'combo') {
        ctx.beginPath()
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(250, 250, 250, ${(1 - t) * 0.28})`
        ctx.lineWidth = 1.4 * (1 - t * 0.45)
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(250, 250, 250, ${1 - t})`
        ctx.lineWidth = 2.5 * (1 - t)
        ctx.stroke()
      }
    }
  }

  private drawPopups(system: ParticleSystem): void {
    const ctx = this.ctx
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const pop of system.popups) {
      const t = clamp(pop.age / pop.life, 0, 1)
      const y = pop.y - t * 48
      const scale = 1 + (pop.combo - 1) * 0.12
      const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85
      ctx.save()
      ctx.translate(pop.x, y)
      ctx.scale(scale, scale)
      ctx.globalAlpha = clamp(alpha, 0, 1)
      if (pop.label) {
        ctx.font = `600 ${18 + (pop.combo - 1) * 2}px "Space Grotesk", "DM Sans", system-ui, sans-serif`
        ctx.fillStyle = COLORS.text
        ctx.fillText(pop.label, 0, 0)
      } else {
        ctx.font = `600 ${14 + (pop.combo - 1) * 2}px "Space Grotesk", "DM Sans", system-ui, sans-serif`
        ctx.fillStyle = COLORS.text
        ctx.fillText(`+${pop.value}`, 0, 0)
      }
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }
}
