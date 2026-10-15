// Kitap detay kartı — ziyaretçiler ve sahip için

import { Pencil, Trash2, X } from 'lucide-react';
import type { Book } from '../types';
import { BookCover } from './BookCover';
import { StatusBadge } from './StatusBadge';
import { Modal } from './ui';

interface BookDetailModalProps {
  book: Book | null;
  coverSrc: string;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
  onCycleStatus: (book: Book) => void;
}

export function BookDetailModal({ book, coverSrc, canEdit, onClose, onEdit, onDelete, onCycleStatus }: BookDetailModalProps) {
  return (
    <Modal open={book !== null} onClose={onClose} size="lg">
      {book && (
        <div className="grid gap-6 p-5 sm:grid-cols-[200px_1fr] sm:p-7">
          <div className="mx-auto aspect-[3/4] w-40 overflow-hidden rounded-md shadow-[0_18px_36px_-14px_rgba(26,26,26,0.5)] ring-1 ring-ink/5 sm:w-full">
            <BookCover book={book} src={coverSrc} />
          </div>
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-serif text-2xl font-semibold leading-tight sm:text-3xl">{book.title}</h2>
                <p className="mt-1 text-base text-muted">{book.author || 'Yazar bilinmiyor'}</p>
              </div>
              <button type="button" className="icon-btn -mr-2 -mt-1 shrink-0" onClick={onClose} aria-label="Kapat">
                <X size={18} />
              </button>
            </div>

            <div className="mt-3">
              <StatusBadge status={book.status} size="md" onClick={canEdit ? () => onCycleStatus(book) : undefined} />
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Item label="Yayınevi" value={book.publisher} />
              <Item label="Tür" value={book.genre} />
              <Item label="Sayfa" value={book.pageCount ? String(book.pageCount) : ''} />
              <Item label="Basım Yılı" value={book.publicationYear ? String(book.publicationYear) : ''} />
              <Item label="Eklenme" value={new Date(book.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} />
            </dl>

            {book.notes && (
              <blockquote className="mt-5 whitespace-pre-wrap border-l-2 border-accent/60 pl-4 font-serif text-[15px] italic leading-relaxed text-ink/85">{book.notes}</blockquote>
            )}

            {canEdit && (
              <div className="mt-6 flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => onEdit(book)}>
                  <Pencil size={15} />
                  Düzenle
                </button>
                <button type="button" className="btn-ghost text-danger hover:text-danger" onClick={() => onDelete(book)}>
                  <Trash2 size={15} />
                  Sil
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Item({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted">{label}</dt>
      <dd className={`mt-0.5 ${mono ? 'font-mono text-[13px]' : ''}`}>{value || '—'}</dd>
    </div>
  );
}
