export default function Button({ variant = 'default', size = 'md', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-[13px]',
  };
  const variants = {
    default: 'border border-ink/15 bg-white text-ink hover:bg-ink/5 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/5',
    primary: 'bg-ink text-white hover:bg-ink/85 dark:bg-brass-500 dark:text-noir dark:hover:bg-brass-400',
    danger: 'border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10',
    ghost: 'text-ink/60 hover:bg-ink/5 dark:text-white/60 dark:hover:bg-white/5',
  };
  return <button {...props} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} />;
}