import { AnimatePresence, motion } from 'framer-motion'
import { Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GameOver } from '@/components/GameOver'
import { HUD } from '@/components/HUD'
import { Menu } from '@/components/Menu'
import { PauseMenu } from '@/components/PauseMenu'
import { useGame } from '@/hooks/useGame'
import { overlayVariants, transitionFast, transitionSpring } from '@/lib/motion'

export default function App() {
  const {
    snapshot,
    containerRef,
    canvasRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    play,
    pause,
    resume,
    restart,
    quitToMenu,
    toggleMute,
    toggleHaptics,
  } = useGame()

  const {
    phase,
    score,
    bestScore,
    combo,
    runMaxCombo,
    elapsed,
    muted,
    haptics,
    isNewBest,
    dying,
    activeEvent,
  } = snapshot
  const showHud = (phase === 'playing' || phase === 'paused') && !dying
  const showPause = phase === 'playing' && !dying

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <div ref={containerRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      <AnimatePresence>
        {showHud && (
          <motion.div
            key="hud"
            className="pointer-events-none absolute inset-0 z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: transitionFast }}
          >
            <HUD
              score={score}
              best={bestScore}
              combo={combo}
              elapsed={elapsed}
              activeEvent={activeEvent}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPause && (
          <motion.div
            key="pause-btn"
            className="absolute inset-x-0 bottom-0 z-20 flex justify-center pb-[max(2.75rem,calc(var(--zen-safe-bottom)+1.5rem))]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10, transition: transitionFast }}
            transition={transitionSpring}
          >
            <Button
              variant="glass"
              size="icon"
              onClick={pause}
              aria-label="Pause"
            >
              <Pause size={18} />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {phase === 'menu' && (
          <motion.div
            key="menu"
            className="absolute inset-0 z-30"
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Menu
              best={bestScore}
              muted={muted}
              haptics={haptics}
              onPlay={play}
              onToggleMute={toggleMute}
              onToggleHaptics={toggleHaptics}
            />
          </motion.div>
        )}
        {phase === 'paused' && (
          <motion.div
            key="pause"
            className="absolute inset-0 z-30"
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <PauseMenu
              muted={muted}
              haptics={haptics}
              onResume={resume}
              onRestart={restart}
              onQuit={quitToMenu}
              onToggleMute={toggleMute}
              onToggleHaptics={toggleHaptics}
            />
          </motion.div>
        )}
        {phase === 'gameover' && (
          <motion.div
            key="over"
            className="absolute inset-0 z-30"
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <GameOver
              score={score}
              best={bestScore}
              highCombo={runMaxCombo}
              isNewBest={isNewBest}
              onPlayAgain={restart}
              onMenu={quitToMenu}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[5] bg-[radial-gradient(ellipse_at_center,transparent_62%,rgba(0,0,0,0.28)_100%)]"
      />
      <div aria-hidden className="noise-overlay" />
    </div>
  )
}
