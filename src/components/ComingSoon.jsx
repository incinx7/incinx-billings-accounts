import { Construction } from 'lucide-react';

export default function ComingSoon({ title, phase }) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
      <div className="border-b border-ink/10 px-5 py-3.5 text-[13px] font-semibold text-ink dark:border-white/10 dark:text-white">
        {title}
      </div>
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <Construction size={28} strokeWidth={1.5} className="text-ink/30 dark:text-white/30" />
        <div className="max-w-sm text-[13px] leading-relaxed text-ink/45 dark:text-white/45">
          {title} will be built out in {phase || 'a later phase'}.
          <br />
          The page shell, routing, and shared data are already wired up — just the module UI is pending.
        </div>
      </div>
    </div>
  );
}