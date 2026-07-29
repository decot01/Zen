import { COLORS, ENEMY, PLAYER, PRIZE_ORB } from './constants'
import type { Enemy } from './Enemy'
import type { Orb } from './Orb'
import type { ParticleSystem } from './Particles'
import type { Player } from './Player'
import { clamp } from '@/utils/math'

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
    } = { showPlayer: true },
  ): void {
    const ctx = this.ctx
    const shake = particles.getShakeOffset()
    const worldAlpha = clamp(options.worldAlpha ?? 1, 0, 1)

    ctx.save()
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, this.width, this.height)

    ctx.translate(shake.x, shake.y)

    this.drawAmbient()

    for (const orb of orbs) {
      if (orb.alive) this.drawWhiteOrb(orb)
    }

    for (const enemy of enemies) {
      if (enemy.alive) this.drawEnemy(enemy)
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

    if (options.dimmed) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fillRect(-shake.x, -shake.y, this.width, this.height)
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
    const scale = enemy.scale * enemy.pulse
    const r = enemy.radius * scale
    const alpha = enemy.alpha

    ctx.save()
    ctx.translate(enemy.x, enemy.y)
    ctx.globalAlpha = alpha

    ctx.shadowColor = enemy.armed ? COLORS.white : COLORS.danger
    ctx.shadowBlur = enemy.armed
      ? ENEMY.glowBlur * 0.7
      : ENEMY.glowBlur * 0.35

    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = enemy.armed ? COLORS.dangerDark : 'rgba(63, 63, 70, 0.55)'
    ctx.fill()

    ctx.shadowBlur = 0
    ctx.lineWidth = enemy.armed ? 2.2 : 1.5
    ctx.strokeStyle = enemy.armed ? COLORS.white : COLORS.danger
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2)
    ctx.fillStyle = enemy.armed ? COLORS.white : 'rgba(250, 250, 250, 0.35)'
    ctx.fill()

    if (!enemy.armed) {
      ctx.globalAlpha = 0.3 + enemy.armProgress * 0.45
      ctx.strokeStyle = COLORS.white
      ctx.lineWidth = 1.25
      ctx.beginPath()
      ctx.arc(0, 0, r * (1.45 + (1 - enemy.armProgress) * 0.55), 0, Math.PI * 2)
      ctx.stroke()
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
