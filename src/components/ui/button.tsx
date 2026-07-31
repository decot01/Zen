import {
  Children,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { pulseHaptic } from '@/lib/feel'
import { cn } from '@/lib/utils'

/**
 * BetterUI-inspired button structure:
 * .button > .stroke + .fill + .raycast + content
 * Hover via :has(.raycast:hover) — enlarged hit zone, instant stroke/fill feedback.
 * @see https://github.com/decot01/BetterUI
 */

/** Exact HUD banner Card surface classes. */
export const glassSurfaceClassName =
  'zen-squircle rounded-xl border border-border/60 bg-card/70 text-card-foreground shadow-sm backdrop-blur-md'

const buttonVariants = cva('zen-btn', {
  variants: {
    variant: {
      default: 'zen-btn--default',
      secondary: 'zen-btn--secondary',
      outline: 'zen-btn--outline',
      ghost: 'zen-btn--ghost',
      destructive: 'zen-btn--destructive',
      /** Surface matches HUD banner Card 1:1. */
      glass: 'zen-btn--glass',
    },
    size: {
      default: 'zen-btn--md',
      sm: 'zen-btn--sm',
      lg: 'zen-btn--lg',
      icon: 'zen-btn--icon',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
})

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  children?: ReactNode
}

export function Button({
  className,
  variant,
  size,
  children,
  type = 'button',
  onPointerDown,
  ...props
}: ButtonProps) {
  const childArray = Children.toArray(children)
  const hasIconOnly = size === 'icon'
  const isGlass = variant === 'glass'

  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      onPointerDown={(e) => {
        if (!e.button) pulseHaptic('ui')
        onPointerDown?.(e)
      }}
      {...props}
    >
      <span className="zen-btn__stroke" aria-hidden />
      {isGlass ? (
        <span
          className={cn('zen-btn__glass-surface', glassSurfaceClassName)}
          aria-hidden
        />
      ) : (
        <span className="zen-btn__fill" aria-hidden />
      )}
      <span className="zen-btn__raycast" aria-hidden />
      <span
        className={cn(
          'zen-btn__content',
          hasIconOnly && 'zen-btn__content--icon',
        )}
      >
        {childArray}
      </span>
    </button>
  )
}

export { buttonVariants }
