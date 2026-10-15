import { memo } from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import type { Book } from '../types';
import { BookCover } from './BookCover';
import { StatusBadge } from './StatusBadge';

interface BookCardProps {
  book: Book;
  coverSrc: string;
  canEdit: boolean;
  selected: boolean;
  statusBusy: boolean;
  onOpen: (book: Book) => void;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
  onToggleSelect: (book: Book) => void;
  onCycleStatus: (book: Book) => void;
}

function BookCardBase({ book, coverSrc, canEdit, selected, statusBusy, onOpen, onEdit, onDelete, onToggleSelect, onCycleStatus }: BookCardProps) {
  return (
    <article className="group relative flex flex-col">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(book)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onOpen(book);
        }}
        className={`relative aspect-[3/4] cursor-pointer overflow-hidden rounded-md bg-soft shadow-[0_1px_2px_rgba(26,26,26,0.08),0_8px_24px_-12px_rgba(26,26,26,0.35)] ring-1 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_2px_4px_rgba(26,26,26,0.08),0_18px_36px_-14px_rgba(26,26,26,0.45)] ${
          selected ? 'ring-2 ring-ink' : 'ring-ink/5'
        }`}
      >
        <BookCover book={book} src={coverSrc} />
        {/* sırt gölgesi — gerçek kitap hissi */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/25 to-transparent" />

        <div className="absolute bottom-2 left-2">
          <StatusBadge status={book.status} onClick={canEdit ? () => onCycleStatus(book) : undefined} busy={statusBusy} />
        </div>

        {canEdit && (
          <>
            <button
              type="button"
              aria-label={selected ? 'Seçimi kaldır' : 'Seç'}
              onClick={(event) => {
                event.stopPropagation();
                onToggleSelect(book);
              }}
              className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border transition ${
                selected
                  ? 'border-ink bg-ink text-paper'
                  : 'border-white/80 bg-white/80 text-transparent opacity-100 backdrop-blur sm:opacity-0 sm:group-hover:opacity-100'
              }`}
            >
              <Check size={14} strokeWidth={3} />
            </button>
            <div className="absolute right-2 top-2 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
              <button
                type="button"
                aria-label="Düzenle"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(book);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-ink shadow-sm backdrop-blur hover:bg-white"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                aria-label="Sil"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(book);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-danger shadow-sm backdrop-blur hover:bg-white"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </>
        )}
      </div>
      <div className="mt-2.5 min-w-0 px-0.5">
        <h3 className="line-clamp-2 font-serif text-[15px] font-semibold leading-snug">{book.title}</h3>
        <p className="mt-0.5 truncate text-[13px] text-muted">{book.author || 'Yazar bilinmiyor'}</p>
        <p className="mt-0.5 truncate text-[11px] uppercase tracking-[0.08em] text-accent">
          {[book.genre, book.pageCount ? `${book.pageCount} s.` : ''].filter(Boolean).join(' · ')}
        </p>
      </div>
    </article>
  );
}

export const BookCard = memo(BookCardBase);
