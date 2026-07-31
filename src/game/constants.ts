/** All gameplay and visual tunables — no magic numbers elsewhere. */

export const COLORS = {
  background: '#000000',
  card: '#0A0A0A',
  border: '#27272A',
  text: '#FFFFFF',
  accent: '#FFFFFF',
  danger: '#737373',
  dangerDark: '#525252',
  white: '#FFFFFF',
  flash: 'rgba(255, 255, 255, 0.5)',
} as const

export const PLAYER = {
  radius: 14,
  glowBlur: 22,
  pulseSpeed: 2.2,
  pulseAmount: 0.06,
  attractStrength: 2100,
  maxSpeed: 560,
  damping: 3.1,
  releaseDamping: 0.95,
  wallBounce: 0.62,
  trailLength: 22,
  trailSpacing: 1.8,
  stretchMax: 0.28,
  stretchSpeedRef: 420,
  comboGlowBoost: 0.12,
  /** Cooldown so one wall contact doesn't re-fire every frame. */
  wallImpactCooldown: 0.14,
  /** How long + how hard to mute speed-stretch after a wall kick. */
  bounceStretchMuteDuration: 0.55,
  bounceStretchMute: 0.95,
} as const

export const WHITE_ORB = {
  radius: 9,
  /** Generous collect feel — larger than the drawn disc. */
  hitRadius: 15,
  glowBlur: 10,
  floatAmplitude: 5,
  floatSpeed: 1.0,
  spawnScaleDuration: 0.42,
  baseScore: 10,
  count: 3,
  maxCount: 5,
} as const

export const ENEMY = {
  radius: 13,
  glowBlur: 12,
  armDuration: 0.7,
  spawnAlpha: 0.4,
  initialCount: 3,
  maxCount: 10,
  pulseSpeed: 2.4,
} as const

export const DIFFICULTY = {
  /** Stage N at N × interval (stage 2 ≈ 20s). */
  intervalSeconds: 10,
  /** Add an enemy every N difficulty ticks (keeps mid-game breathable). */
  enemyEveryTicks: 2,
  enemyIncrement: 1,
  speedMultiplier: 1.045,
  spawnRateMultiplier: 0.92,
  safeRadiusShrink: 0.96,
  minSafeRadius: 78,
  initialSafeRadius: 105,
  initialBonusOrbInterval: 8,
  minBonusOrbInterval: 4,
} as const

export const COMBO = {
  /** Tight chain window — hard to hold on mobile. */
  expireSeconds: 0.85,
  expireDecayPerLevel: 0.055,
  minExpireSeconds: 0.45,
  maxMultiplier: 10,
  /** Extra distance when respawning during an active streak. */
  respawnDistancePerLevel: 18,
} as const

/** Rare high-value orb — mid game, flees, short lifetime. */
export const PRIZE_ORB = {
  radius: 8,
  hitRadius: 11,
  score: 100,
  lifetime: 5,
  /** Appear starting from difficulty stage 1 (after ~10s). */
  minDifficultyTicks: 1,
  firstDelayMin: 4,
  firstDelayMax: 9,
  respawnMin: 10,
  respawnMax: 18,
  fleeSpeed: 235,
  fleeRange: 210,
  /** Extra clearance around enemies while steering. */
  hazardPadding: 56,
  glowBlur: 28,
} as const

export const COMBO_FX = {
  ringDuration: 0.5,
  ringMaxRadius: 78,
  sparkCount: 0,
} as const

export const PARTICLES = {
  maxCount: 120,
  collectCount: 10,
  collectSpeed: 180,
  collectLife: 0.55,
  deathCount: 42,
  deathSpeed: 420,
  deathLife: 0.9,
  shockwaveDuration: 0.55,
  shockwaveMaxRadius: 220,
  flashDuration: 0.22,
  shakeDuration: 0.4,
  shakeMagnitude: 14,
} as const

export const SPAWN = {
  padding: 28,
  /** Keep entities clear of the top HUD banner. */
  topInset: 108,
  /** Keep entities clear of the bottom pause control. */
  bottomInset: 92,
  minDistanceFromPlayer: 88,
  minDistanceBetween: 64,
  /** Cap how far orbs must spawn from the player (avoids zero-orb softlock). */
  maxOrbPlayerSafe: 120,
  /** When no cluster anchors, prefer a reachable ring around the player. */
  orbNearPlayerMin: 95,
  orbNearPlayerMax: 165,
  /**
   * Hard minimum center-to-center between white orb and enemy.
   * Includes visual radii + float drift so they never look glued.
   */
  orbEnemyMinDistance: 90,
  /**
   * Bias white orbs toward nearby enemies so early routes skim past danger.
   * Must stay ≥ orbEnemyMinDistance.
   */
  orbThreatMin: 96,
  orbThreatMax: 140,
  /** Threat-bait chance by difficulty stage (0 = early, 1 = 2nd, 2+ = 3rd). */
  orbThreatBiasByStage: [0.1, 0.2, 0.3],
  /** Keep new white orbs near existing ones (cluster play). */
  orbClusterMin: 64,
  orbClusterMax: 140,
  maxAttempts: 64,
} as const

export const LOOP = {
  maxDelta: 1 / 30,
  uiSnapshotHz: 12,
} as const

export const SCORE_POPUP = {
  life: 0.85,
  riseSpeed: 48,
} as const

/** Timed world events — independent from difficulty ticks. */
export const EVENTS = {
  cooldownMin: 15,
  cooldownMax: 25,
  fadeIn: 0.55,
  fadeOut: 0.55,
  energyWalls: {
    /** Early pool opens together so first event is not always walls. */
    unlockStage: 2,
    duration: 12,
    /** White frame thickness along playfield edges. */
    borderThickness: 5,
    /** Soft push starts this far before the ball touches the border. */
    bandWidth: 20,
    pushStrength: 9500,
    pushMaxSpeed: 1600,
    /** Minimum outward speed after a wall hit. */
    bounceKick: 1450,
    /** Expand-from-center open duration (seconds). */
    openDuration: 0.85,
    /** Wall frame “jerk” when the ball bounces. */
    impactDuration: 0.22,
    impactOffset: 12,
  },
  shockwave: {
    unlockStage: 2,
    duration: 12,
    intervalMin: 2.5,
    intervalMax: 3.0,
    maxWaves: 4,
    /** Thickness of the energy band. */
    bandWidth: 42,
    /** Seconds for a wave to cross the arena. */
    travelDuration: 1.4,
    playerImpulse: 1180,
    playerMaxSpeed: 1020,
    knockDecay: 3.8,
  },
  berserk: {
    unlockStage: 2,
    duration: 18,
    radiusMul: 1.55,
    huntSpeed: 95,
    glowMul: 2.4,
  },
  chainExplosion: {
    unlockStage: 4,
    durationMin: 12,
    durationMax: 15,
    /** Seconds between spontaneous charge picks. */
    pickIntervalMin: 1.0,
    pickIntervalMax: 1.5,
    chargeDuration: 0.8,
    blastRadius: 78,
    /** Chance a nearby enemy starts charging after a blast. */
    chainChance: 0.7,
    maxCharging: 2,
    maxChainExplosions: 6,
    scorePerBlast: 25,
    chargeScale: 1.32,
    warnParticleInterval: 0.07,
  },
  sniper: {
    unlockStage: 4,
    duration: 15,
    /** Seconds between drone appearances. */
    interval: 3,
    maxShots: 4,
    /** Laser follows the player. */
    trackDuration: 1.0,
    /** Aim frozen — dodge window before fire. */
    lockDuration: 0.6,
    /** Hit radius of the fired beam (centerline). */
    laserHalfWidth: 5,
    droneMargin: 28,
    droneSize: 10,
    leaveDuration: 0.35,
  },
  crossfire: {
    /** Disabled — keep code, exclude from schedule. */
    enabled: false,
    unlockStage: 6,
    duration: 12,
    maxWaves: 7,
    /** Warning total ≈ track + lock = 1.5s. */
    trackDuration: 0.9,
    lockDuration: 0.6,
    intervalEarly: 2.35,
    intervalLate: 1.5,
  },
  bulletHell: {
    /** Disabled — keep code, exclude from schedule. */
    enabled: false,
    unlockStage: 8,
    duration: 15,
    maxWaves: 7,
    /** Red crossfire warning ≈ 1.5s. */
    trackDuration: 0.9,
    lockDuration: 0.6,
    intervalEarly: 2.2,
    intervalLate: 1.45,
    /** Yellow execution laser — shorter warn. */
    yellowTrack: 0.45,
    yellowLock: 0.4,
    yellowPredict: 0.28,
    yellowCooldown: 3,
    maxYellow: 5,
  },
  phaseShift: {
    /** Disabled — keep code, exclude from schedule. */
    enabled: false,
    unlockStage: 4,
    duration: 15,
    phaseDuration: 2,
    interval: 2,
    /** Exact share of armed enemies that phase each wave. */
    fraction: 0.5,
    minLethal: 1,
    particleInterval: 0.055,
  },
  radar: {
    /** Disabled — keep code, exclude from schedule. */
    enabled: false,
    unlockStage: 5,
    duration: 15,
    interval: 3.25,
    maxPulses: 5,
    revealDuration: 1.2,
    /** Seconds for a pulse to cross the arena. */
    pulseTravel: 1.15,
    /** Deep arena darken — no local lamp. */
    maxDarkness: 0.88,
  },
} as const
