import { Menu, Moon, Sun, Cloud, CloudOff, RefreshCw } from 'lucide-react';

function SyncIndicator({ status, onRetry }) {
  if (status === 'syncing') {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-ink/40 dark:text-white/40">
        <RefreshCw size={12} className="animate-spin" /> Saving…
      </span>
    );
  }
  if (status === 'error') {
    return (
      <button
        onClick={onRetry}
        title="Click to retry saving to Supabase"
        className="flex items-center gap-1.5 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/15"
      >
        <CloudOff size={12} /> Sync failed — retry
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-ink/30 dark:text-white/30">
      <Cloud size={12} /> Synced
    </span>
  );
}

export default function Topbar({ title, dark, onToggleDark, onOpenMobile, actions, syncStatus, onRetrySync }) {
  return (
    <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-ink/[0.08] bg-paper px-6 dark:border-white/10 dark:bg-noir-soft">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="rounded-md p-1.5 text-ink/50 hover:bg-ink/[0.05] hover:text-ink md:hidden"
        >
          <Menu size={20} />
        </button>
        <h1 className="font-serif text-[22px] font-medium text-ink dark:text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {syncStatus && <SyncIndicator status={syncStatus} onRetry={onRetrySync} />}
        <button
          onClick={onToggleDark}
          title="Toggle dark mode"
          className="rounded-md border border-ink/10 p-2 text-ink/60 transition-colors hover:bg-ink/[0.05] hover:text-ink dark:border-white/15 dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <div className="flex gap-2">{actions}</div>
      </div>
    </div>
  );
}
