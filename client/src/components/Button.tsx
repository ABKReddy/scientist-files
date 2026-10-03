import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';

export const Spinner = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn border border-crimson/50 bg-crimson/15 text-crimson-soft hover:bg-crimson/25 hover:shadow-glow-red',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3.5 py-2 text-[11px]',
  md: 'px-5 py-2.5 text-xs',
  lg: 'px-8 py-4 text-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      loadingText,
      fullWidth = false,
      icon,
      children,
      className = '',
      disabled,
      ...rest
    },
    ref
  ) => (
    <motion.button
      ref={ref}
      type="button"
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      className={`${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...(rest as Record<string, unknown>)}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {!loading && icon}
      <span className={loading && loadingText ? 'opacity-90' : ''}>{loading && loadingText ? loadingText : children}</span>
    </motion.button>
  )
);

Button.displayName = 'Button';