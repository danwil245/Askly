const VARIANTS = {
  primary:
    'bg-primary text-primary-fg hover:brightness-110 active:brightness-95 shadow-card disabled:opacity-50',
  accent:
    'bg-accent text-accent-fg hover:brightness-110 active:brightness-95 shadow-card disabled:opacity-50',
  outline:
    'border border-border bg-surface text-fg hover:bg-surface-2 active:bg-surface-2 disabled:opacity-50',
  ghost: 'text-fg hover:bg-surface-2 active:bg-surface-2 disabled:opacity-50',
  danger:
    'bg-danger text-white hover:brightness-110 active:brightness-95 shadow-card disabled:opacity-50',
};

const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

/** Accessible button with on-style variants. Disabled during async via `loading`. */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl font-medium transition-[filter,background-color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}
