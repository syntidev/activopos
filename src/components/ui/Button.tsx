'use client'

import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ReactNode, ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'cta'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    disabled,
    children,
    className,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading

  const cls = [
    styles.btn,
    styles[`variant-${variant}`],
    styles[`size-${size}`],
    fullWidth ? styles.fullWidth : '',
    loading ? styles.loading : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <motion.button
      ref={ref}
      className={cls}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.1 }}
      {...(rest as object)}
    >
      {loading ? (
        <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
      ) : leftIcon ? (
        <span className={styles.iconLeft} aria-hidden="true">{leftIcon}</span>
      ) : null}

      <span className={styles.label}>{children}</span>

      {!loading && rightIcon && (
        <span className={styles.iconRight} aria-hidden="true">{rightIcon}</span>
      )}
    </motion.button>
  )
})
