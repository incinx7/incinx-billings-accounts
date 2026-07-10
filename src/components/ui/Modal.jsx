import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} flex-shrink-0 rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft`}>
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4 dark:border-white/10">
          <h2 className="font-serif text-lg text-ink dark:text-white">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-ink/40 hover:bg-ink/5 hover:text-ink dark:text-white/40 dark:hover:bg-white/5 dark:hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 rounded-b-xl border-t border-ink/10 bg-[#FAFAF8] px-6 py-3.5 dark:border-white/10 dark:bg-black/20">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}