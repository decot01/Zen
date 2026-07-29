import { GameAudio } from './Audio'
import { findFirstCollision } from './Collision'
import {
  COMBO,
  DIFFICULTY,
  ENEMY,
  LOOP,
  PRIZE_ORB,
  SCORE_POPUP,
  SPAWN,
  WHITE_ORB,
} from './constants'
import { Enemy } from './Enemy'
import { Haptics } from './Haptics'
import { Orb } from './Orb'
import { ParticleSystem } from './Particles'
import { Player } from './Player'
import { Renderer } from './Renderer'
import { Spawner } from './Spawner'
import { getChromeInsets, isTelegramMiniApp } from '@/lib/telegram'
import { loadSettings, updateSettings } from '@/utils/storage'
import { randomRange } from '@/utils/random'

export type GamePhase = 'menu' | 'playing' | 'paused' | 'gameover'

export interface GameSnapshot {
  phase: GamePhase
  score: number
  bestScore: number
  combo: number
  highCombo: number
  /** Peak combo reached in the current run (for game over). */
  runMaxCombo: number
  elapsed: number
  muted: boolean
  haptics: boolean
  isNewBest: boolean
  dying: boolean
}

export type SnapshotListener = (snapshot: GameSnapshot) => void

export class Game {
  readonly player = new Player()
  readonly particles = new ParticleSystem()
  readonly audio = new GameAudio()
  readonly haptics = new Haptics()
  readonly spawner = new Spawner()

  private renderer: Renderer | null = null
  private orbs: Orb[] = []
  private enemies: Enemy[] = []

  private phase: GamePhase = 'menu'
  private score = 0
  private bestScore = 0
  private combo = 1
  private highCombo = 1
  private runMaxCombo = 1
  private comboTimer = 0
  private elapsed = 0
  private difficultyTicks = 0
  private targetEnemyCount: number = ENEMY.initialCount
  private bonusOrbInterval: number = DIFFICULTY.initialBonusOrbInterval
  private bonusOrbTimer = 0
  private prizeOrbTimer = 0
  private isNewBest = false

  private width = 0
  private height = 0

  private pointer: { x: number; y: number } | null = null
  private holding = false

  private raf = 0
  private lastTime = 0
  private running = false
  private uiAccum = 0
  private listener: SnapshotListener | null = null
  private deathDelay = 0
  private dying = false
  private playerHidden = false
  /** 1 = full board, 0 = cleared — fades out on death before game over UI. */
  private worldAlpha = 1

  constructor() {
    const settings = loadSettings()
    this.bestScore = settings.bestScore
    this.highCombo = settings.highCombo
    this.audio.setMuted(settings.muted)
    this.haptics.setEnabled(settings.haptics)
  }

  setListener(listener: SnapshotListener | null): void {
    this.listener = listener
    this.emit(true)
  }

  attachCanvas(canvas: HTMLCanvasElement): void {
    this.renderer = new Renderer(canvas)
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    this.renderer?.resize(this.width, this.height, dpr)
  }

  startLoop(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    const tick = (now: number) => {
      if (!this.running) return
      let dt = (now - this.lastTime) / 1000
      this.lastTime = now
      dt = Math.min(dt, LOOP.maxDelta)
      this.update(dt)
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  stopLoop(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  getSnapshot(): GameSnapshot {
    return {
      phase: this.phase,
      score: this.score,
      bestScore: this.bestScore,
      combo: this.combo,
      highCombo: this.highCombo,
      runMaxCombo: this.runMaxCombo,
      elapsed: this.elapsed,
      muted: this.audio.isMuted(),
      haptics: this.haptics.isEnabled(),
      isNewBest: this.isNewBest,
      dying: this.dying,
    }
  }

  setPointer(x: number, y: number, down: boolean): void {
    if (this.phase !== 'playing' || this.dying) return
    this.holding = down
    this.pointer = down ? { x, y } : null
    if (down) void this.audio.ensureRunning()
  }

  movePointer(x: number, y: number): void {
    if (this.phase !== 'playing' || this.dying || !this.holding) return
    this.pointer = { x, y }
  }

  releasePointer(): void {
    this.holding = false
    this.pointer = null
  }

  play(): void {
    void this.audio.ensureRunning()
    this.resetRun()
    this.phase = 'playing'
    this.emit(true)
  }

  pause(): void {
    if (this.phase !== 'playing' || this.dying) return
    this.phase = 'paused'
    this.releasePointer()
    this.emit(true)
  }

  resume(): void {
    if (this.phase !== 'paused') return
    this.phase = 'playing'
    this.lastTime = performance.now()
    this.emit(true)
  }

  restart(): void {
    void this.audio.ensureRunning()
    this.resetRun()
    this.phase = 'playing'
    this.emit(true)
  }

  quitToMenu(): void {
    this.phase = 'menu'
    this.dying = false
    this.playerHidden = false
    this.worldAlpha = 1
    this.releasePointer()
    this.particles.clear()
    this.orbs = []
    this.enemies = []
    this.emit(true)
  }

  toggleMute(): void {
    const muted = !this.audio.isMuted()
    this.audio.setMuted(muted)
    updateSettings({ muted })
    this.emit(true)
  }

  toggleHaptics(): void {
    const enabled = !this.haptics.isEnabled()
    this.haptics.setEnabled(enabled)
    updateSettings({ haptics: enabled })
    if (enabled) this.haptics.pulse('ui')
    this.emit(true)
  }

  private resetRun(): void {
    this.score = 0
    this.combo = 1
    this.comboTimer = 0
    this.runMaxCombo = 1
    this.elapsed = 0
    this.difficultyTicks = 0
    this.targetEnemyCount = ENEMY.initialCount
    this.bonusOrbInterval = DIFFICULTY.initialBonusOrbInterval
    this.bonusOrbTimer = this.bonusOrbInterval
    this.prizeOrbTimer = randomRange(
      PRIZE_ORB.firstDelayMin,
      PRIZE_ORB.firstDelayMax,
    )
    this.deathDelay = 0
    this.dying = false
    this.playerHidden = false
    this.worldAlpha = 1
    this.isNewBest = false
    this.particles.clear()
    this.spawner.reset()
    this.player.reset(this.width, this.height)
    this.orbs = []
    this.enemies = []
    this.releasePointer()
    this.seedEntities()
  }

  private seedEntities(): void {
    // Enemies first so early orbs can bait routes past hazards.
    for (let i = 0; i < this.targetEnemyCount; i++) {
      this.spawnEnemy()
    }
    for (let i = 0; i < WHITE_ORB.count; i++) {
      const pos = this.findOrbSpawn()
      if (pos) this.orbs.push(new Orb(pos.x, pos.y))
    }
  }

  private avoidList(
    excludeOrb: Orb | null = null,
    options: { hazardClearance?: boolean } = {},
  ) {
    return [
      {
        x: this.player.x,
        y: this.player.y,
        radius: this.player.radius,
      },
      ...this.orbs
        .filter((o) => o.alive && o !== excludeOrb)
        .map((o) => ({
          x: o.baseX,
          y: o.baseY,
          radius: o.radius,
          // Enemies must also stay this far from existing orbs.
          ...(options.hazardClearance
            ? {}
            : { minDistance: SPAWN.orbEnemyMinDistance }),
        })),
      ...this.enemies
        .filter((e) => e.alive)
        .map((e) => ({
          x: e.baseX,
          y: e.baseY,
          radius: e.radius,
          ...(options.hazardClearance
            ? { minDistance: SPAWN.orbEnemyMinDistance }
            : {}),
        })),
    ]
  }

  private orbAnchors(excludeOrb: Orb | null = null) {
    return this.orbs
      .filter((o) => o.alive && o !== excludeOrb)
      .map((o) => ({ x: o.baseX, y: o.baseY, radius: o.radius }))
  }

  private threatList() {
    return this.enemies
      .filter((e) => e.alive)
      .map((e) => ({ x: e.baseX, y: e.baseY, radius: e.radius }))
  }

  private findSpawn(extraPlayerSafe = 0) {
    return this.spawner.findPosition(
      this.width,
      this.height,
      this.avoidList(),
      Math.max(this.spawner.safeRadius * 0.5, extraPlayerSafe),
    )
  }

  private findOrbSpawn(excludeOrb: Orb | null = null, extraPlayerSafe = 0) {
    const stages = SPAWN.orbThreatBiasByStage
    const stage = Math.min(this.difficultyTicks, stages.length - 1)
    const threatBias = stages[stage]!

    return this.spawner.findOrbPosition(
      this.width,
      this.height,
      this.avoidList(excludeOrb, { hazardClearance: true }),
      this.orbAnchors(excludeOrb),
      this.threatList(),
      Math.min(
        SPAWN.maxOrbPlayerSafe,
        Math.max(this.spawner.safeRadius * 0.45, extraPlayerSafe),
      ),
      threatBias,
    )
  }

  private spawnEnemy(): void {
    if (this.enemies.length >= ENEMY.maxCount) return
    const pos = this.findSpawn()
    if (pos) this.enemies.push(new Enemy(pos.x, pos.y))
  }

  private update(dt: number): void {
    if (this.dying) {
      this.particles.update(dt)
      // Fade the playfield out before the game-over menu mounts.
      this.worldAlpha = Math.max(0, this.worldAlpha - dt / 0.28)
      if (this.worldAlpha <= 0.001) {
        this.worldAlpha = 0
        this.orbs = []
        this.enemies = []
      }
      this.deathDelay -= dt
      if (this.deathDelay <= 0) {
        this.enterGameOver()
      }
    } else if (this.phase === 'playing') {
      this.updatePlaying(dt)
    }

    this.renderFrame()

    this.uiAccum += dt
    if (this.uiAccum >= 1 / LOOP.uiSnapshotHz) {
      this.uiAccum = 0
      if (this.phase === 'playing' && !this.dying) this.emit(false)
    }
  }

  private enterGameOver(): void {
    this.dying = false
    this.playerHidden = true
    this.worldAlpha = 0
    this.orbs = []
    this.enemies = []
    this.particles.clear()
    this.phase = 'gameover'
    this.emit(true)
  }

  private updatePlaying(dt: number): void {
    this.elapsed += dt

    if (this.combo > 1) {
      this.comboTimer -= dt
      if (this.comboTimer <= 0) {
        this.combo = 1
        this.player.comboGlowTarget = 0
      }
    } else if (this.comboTimer > 0) {
      this.comboTimer -= dt
    }

    const ticks = Math.floor(this.elapsed / DIFFICULTY.intervalSeconds)
    while (this.difficultyTicks < ticks) {
      this.difficultyTicks++
      this.applyDifficulty()
    }

    this.bonusOrbTimer -= dt
    if (this.bonusOrbTimer <= 0) {
      this.bonusOrbTimer = this.bonusOrbInterval
      this.spawnBonusOrb()
    }

    this.updatePrizeOrb(dt)

    this.player.step(
      dt,
      this.holding ? this.pointer : null,
      this.width,
      this.height,
    )

    const chromeTop = isTelegramMiniApp() ? getChromeInsets().top : 0
    const topInset = Math.max(SPAWN.topInset, chromeTop + 72)
    const orbBounds = {
      minX: SPAWN.padding,
      maxX: this.width - SPAWN.padding,
      minY: SPAWN.padding + topInset,
      maxY: this.height - SPAWN.padding - SPAWN.bottomInset,
    }
    const hazards = this.enemies.map((e) => ({
      x: e.x,
      y: e.y,
      radius: e.radius,
    }))
    for (const orb of this.orbs) {
      orb.update(
        dt,
        { x: this.player.x, y: this.player.y },
        orbBounds,
        hazards,
      )
    }
    for (const enemy of this.enemies) enemy.update(dt)

    this.handleCollections()
    if (!this.dying) this.handleEnemyHits()
    this.ensureMinOrbs()

    this.particles.update(dt)
  }

  private updatePrizeOrb(dt: number): void {
    if (this.difficultyTicks < PRIZE_ORB.minDifficultyTicks) return

    const hasPrize = this.orbs.some((o) => o.alive && o.kind === 'prize')
    if (hasPrize) return

    this.prizeOrbTimer -= dt
    if (this.prizeOrbTimer > 0) return

    this.spawnPrizeOrb()
    this.prizeOrbTimer = randomRange(PRIZE_ORB.respawnMin, PRIZE_ORB.respawnMax)
  }

  private spawnPrizeOrb(): void {
    if (this.orbs.some((o) => o.alive && o.kind === 'prize')) return
    const pos = this.findOrbSpawn()
    if (!pos) return
    const dead = this.orbs.find((o) => !o.alive)
    if (dead) dead.respawn(pos.x, pos.y, 'prize')
    else this.orbs.push(new Orb(pos.x, pos.y, 'prize'))
  }

  /** Never leave the board without collectibles (softlock after clearing all). */
  private ensureMinOrbs(): void {
    if (this.dying) return
    let alive = this.orbs.filter((o) => o.alive && o.kind === 'normal').length
    while (alive < WHITE_ORB.count) {
      const pos = this.findOrbSpawn()
      if (!pos) break
      const dead = this.orbs.find((o) => !o.alive)
      if (dead) {
        dead.respawn(pos.x, pos.y, 'normal')
      } else if (this.orbs.length < WHITE_ORB.maxCount + 1) {
        this.orbs.push(new Orb(pos.x, pos.y, 'normal'))
      } else {
        break
      }
      alive++
    }
  }

  private spawnBonusOrb(): void {
    if (
      this.orbs.filter((o) => o.alive && o.kind === 'normal').length >=
      WHITE_ORB.maxCount
    ) {
      return
    }
    const pos = this.findOrbSpawn()
    if (pos) this.orbs.push(new Orb(pos.x, pos.y, 'normal'))
  }

  private applyDifficulty(): void {
    this.targetEnemyCount = Math.min(
      ENEMY.maxCount,
      this.targetEnemyCount + DIFFICULTY.enemyIncrement,
    )
    while (this.enemies.length < this.targetEnemyCount) {
      this.spawnEnemy()
    }
    this.player.scaleDifficulty(DIFFICULTY.speedMultiplier)
    this.spawner.shrinkSafeSpace(DIFFICULTY.safeRadiusShrink)
    this.bonusOrbInterval = Math.max(
      DIFFICULTY.minBonusOrbInterval,
      this.bonusOrbInterval * DIFFICULTY.spawnRateMultiplier,
    )
  }

  private handleCollections(): void {
    const hit = findFirstCollision(
      this.player.x,
      this.player.y,
      this.player.radius * 1.05,
      this.orbs,
      (o) => o.collectible,
    )
    if (!hit) return

    const prevCombo = this.combo
    if (this.comboTimer > 0) {
      this.combo = Math.min(COMBO.maxMultiplier, this.combo + 1)
    } else {
      this.combo = 1
    }
    this.comboTimer = Math.max(
      COMBO.minExpireSeconds,
      COMBO.expireSeconds - (this.combo - 1) * COMBO.expireDecayPerLevel,
    )
    this.player.comboGlowTarget = Math.max(0, this.combo - 1)

    if (this.combo > this.runMaxCombo) {
      this.runMaxCombo = this.combo
    }
    if (this.combo > this.highCombo) {
      this.highCombo = this.combo
      updateSettings({ highCombo: this.highCombo })
    }

    const isPrize = hit.kind === 'prize'
    const points = (isPrize ? PRIZE_ORB.score : WHITE_ORB.baseScore) * this.combo
    this.score += points

    this.particles.emitCollect(hit.x, hit.y, this.combo, '#FFFFFF')
    this.particles.addPopup(
      hit.x,
      hit.y - 10,
      points,
      this.combo,
      SCORE_POPUP.life,
    )

    this.audio.playCollect()
    if (isPrize || (this.combo > prevCombo && this.combo > 1)) {
      this.haptics.pulse('combo')
    } else {
      this.haptics.pulse('collect')
    }
    if (this.combo > prevCombo && this.combo > 1) {
      this.particles.emitCombo(this.player.x, this.player.y, this.combo)
      this.audio.playCombo(this.combo)
    }

    if (isPrize) {
      hit.alive = false
      return
    }

    const chainDistance =
      this.combo > 1
        ? Math.min(
            SPAWN.maxOrbPlayerSafe,
            SPAWN.minDistanceFromPlayer +
              this.combo * COMBO.respawnDistancePerLevel,
          )
        : 0
    const pos = this.findOrbSpawn(hit, chainDistance)
    if (pos) {
      hit.respawn(pos.x, pos.y, 'normal')
    } else {
      const fallback = this.findOrbSpawn(hit, 0)
      if (fallback) hit.respawn(fallback.x, fallback.y, 'normal')
      else hit.alive = false
    }
  }

  private handleEnemyHits(): void {
    const hit = findFirstCollision(
      this.player.x,
      this.player.y,
      this.player.radius * 0.75,
      this.enemies,
      (e) => e.alive && e.armed,
    )
    if (!hit) return
    this.killPlayer()
  }

  private killPlayer(): void {
    this.audio.playDeath()
    this.haptics.pulse('death')
    const deathX = this.player.x
    const deathY = this.player.y
    this.particles.emitDeath(deathX, deathY)
    this.releasePointer()
    this.player.clearTrail()
    this.player.vx = 0
    this.player.vy = 0
    this.player.comboGlowTarget = 0
    this.player.comboGlow = 0
    // Park off-screen so nothing can redraw the ball during death FX / game over.
    this.player.x = -1000
    this.player.y = -1000
    this.dying = true
    this.playerHidden = true
    this.worldAlpha = 1
    this.deathDelay = 0.38

    if (this.score > this.bestScore) {
      this.bestScore = this.score
      this.isNewBest = true
      updateSettings({ bestScore: this.bestScore })
    } else {
      this.isNewBest = false
    }

    // Let React hide HUD immediately while the board fades.
    this.emit(true)
  }

  private renderFrame(): void {
    if (!this.renderer) return

    if (this.phase === 'menu' || this.phase === 'gameover') {
      this.renderer.render(this.player, [], [], this.particles, {
        showPlayer: false,
      })
      return
    }

    const showPlayer =
      this.phase === 'playing' && !this.dying && !this.playerHidden

    this.renderer.render(this.player, this.orbs, this.enemies, this.particles, {
      showPlayer,
      dimmed: this.phase === 'paused',
      worldAlpha: this.dying ? this.worldAlpha : 1,
    })
  }

  private emit(force: boolean): void {
    if (!this.listener) return
    if (!force && this.phase !== 'playing') return
    this.listener(this.getSnapshot())
  }
}
