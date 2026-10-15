import { BookCheck, BookOpen, BookMarked } from 'lucide-react';
import type { ReadingStatus } from '../types';

export const STATUS_STYLE: Record<ReadingStatus, string> = {
  Okunmadı: 'bg-white/95 text-muted border-line',
  Okunuyor: 'bg-[#fbf3e4] text-reading border-[#ecd7ad]',
  Okundu: 'bg-[#eaf2ec] text-read border-[#c9dccf]',
};

const ICONS: Record<ReadingStatus, typeof BookOpen> = {
  Okunmadı: BookMarked,
  Okunuyor: BookOpen,
  Okundu: BookCheck,
};

interface StatusBadgeProps {
  status: ReadingStatus;
  /** Verilirse rozet tıklanabilir olur (durum döngüsü) */
  onClick?: () => void;
  busy?: boolean;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, onClick, busy = false, size = 'sm' }: StatusBadgeProps) {
  const Icon = ICONS[status];
  const classes = `inline-flex items-center gap-1 rounded-full border font-medium ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'} ${STATUS_STYLE[status]}`;
  if (!onClick) {
    return (
      <span className={classes}>
        <Icon size={size === 'sm' ? 12 : 14} />
        {status}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      disabled={busy}
      title="Durumu değiştir"
      className={`${classes} shadow-sm transition hover:brightness-95 active:scale-95 disabled:opacity-60`}
    >
      <Icon size={size === 'sm' ? 12 : 14} />
      {status}
    </button>
  );
}
