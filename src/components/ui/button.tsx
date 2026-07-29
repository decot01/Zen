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

const buttonVariants = cva('zen-btn', {
  variants: {
    variant: {
      default: 'zen-btn--default',
      secondary: 'zen-btn--secondary',
      outline: 'zen-btn--outline',
      ghost: 'zen-btn--ghost',
      destructive: 'zen-btn--destructive',
      /** Same surface as HUD banner Card. */
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

  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      onPointerDown={(e) => {
        if (!e.button) pulseHaptic('tap')
        onPointerDown?.(e)
      }}
      {...props}
    >
      <span className="zen-btn__stroke" aria-hidden />
      <span className="zen-btn__fill" aria-hidden />
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
