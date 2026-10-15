// Seçim yapıldığında altta beliren yüzen toplu işlem çubuğu

import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import type { ReadingStatus } from '../types';
import { READING_STATUSES } from '../types';
import { Spinner } from './ui';

interface BulkBarProps {
  count: number;
  busy: boolean;
  onSetStatus: (status: ReadingStatus) => void;
  onClear: () => void;
}

export function BulkBar({ count, busy, onSetStatus, onClear }: BulkBarProps) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-2xl bg-ink px-3 py-2.5 text-paper shadow-2xl sm:flex-nowrap sm:px-4"
        >
          <span className="mr-auto flex items-center gap-2 pl-1 text-sm font-medium">
            {busy && <Spinner size={14} />}
            <span className="tabular-nums">{count}</span> Kitap Seçildi
          </span>
          <div className="flex gap-1">
            {READING_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                disabled={busy}
                onClick={() => onSetStatus(status)}
                className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium transition hover:bg-white/20 disabled:opacity-50 sm:px-3"
              >
                {status}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClear} disabled={busy} className="flex h-8 w-8 items-center justify-center rounded-lg text-paper/70 transition hover:bg-white/10 hover:text-paper" aria-label="Seçimi temizle" title="Seçimi temizle">
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
