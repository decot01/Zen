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
  stretchMax: 0.48,
  stretchSpeedRef: 360,
  comboGlowBoost: 0.12,
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
  maxCount: 14,
  pulseSpeed: 2.4,
} as const

export const DIFFICULTY = {
  intervalSeconds: 15,
  enemyIncrement: 1,
  speedMultiplier: 1.045,
  spawnRateMultiplier: 0.92,
  safeRadiusShrink: 0.95,
  minSafeRadius: 70,
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
  /** Appear starting from difficulty stage 2 (after ~15s). */
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
