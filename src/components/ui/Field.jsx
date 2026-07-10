export function Field({ label, children, className }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className || ''}`}>
      {label && (
        <label className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink/45 dark:text-white/40">
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-ink/30 focus:border-ink/40 dark:border-white/15 dark:bg-black/20 dark:text-white dark:placeholder:text-white/25 dark:focus:border-white/40';

export function Input(props) {
  return <input {...props} className={`${inputClass} ${props.className || ''}`} />;
}

export function Select(props) {
  return <select {...props} className={`${inputClass} ${props.className || ''}`} />;
}

export function Textarea(props) {
  return <textarea {...props} className={`${inputClass} resize-y ${props.className || ''}`} />;
}