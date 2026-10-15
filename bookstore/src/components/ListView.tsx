// Özet tablo — Yazar, sonra Kitap Adı alfabetik; Excel'e aktarma

import { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import type { Book } from '../types';
import { sortByAuthorTitle } from '../lib/filters';
import { exportToExcel } from '../lib/exports';
import { StatusBadge } from './StatusBadge';
import { Spinner, errorMessage, useToast } from './ui';

interface ListViewProps {
  books: readonly Book[];
  canEdit: boolean;
  selectedIds: ReadonlySet<number>;
  onToggleSelect: (book: Book) => void;
  onToggleSelectAll: (books: readonly Book[]) => void;
  onOpen: (book: Book) => void;
}

export function ListView({ books, canEdit, selectedIds, onToggleSelect, onToggleSelectAll, onOpen }: ListViewProps) {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const sorted = useMemo(() => sortByAuthorTitle(books), [books]);
  const allSelected = sorted.length > 0 && sorted.every((book) => selectedIds.has(book.id));

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToExcel(sorted);
      toast.success(`${sorted.length} kitap Excel dosyasına aktarıldı`);
    } catch (error) {
      toast.error(`Excel oluşturulamadı: ${errorMessage(error)}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="font-serif text-lg font-semibold">Özet Liste</h2>
          <p className="text-xs text-muted">Yazar ve kitap adına göre alfabetik · {sorted.length} kitap</p>
        </div>
        <button type="button" className="btn-secondary" onClick={handleExport} disabled={exporting || sorted.length === 0}>
          {exporting ? <Spinner size={15} /> : <FileSpreadsheet size={16} className="text-read" />}
          Excel Olarak İndir
        </button>
      </div>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-soft/70 text-[11px] uppercase tracking-[0.08em] text-muted">
            <tr>
              {canEdit && (
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Tümünü seç"
                    checked={allSelected}
                    onChange={() => onToggleSelectAll(sorted)}
                    className="h-4 w-4 accent-[#1a1a1a]"
                  />
                </th>
              )}
              <th className="w-12 px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Yazar</th>
              <th className="px-3 py-2.5 font-medium">Kitap Adı</th>
              <th className="px-3 py-2.5 font-medium">Yayınevi</th>
              <th className="px-3 py-2.5 font-medium">Tür</th>
              <th className="px-3 py-2.5 text-right font-medium">Sayfa</th>
              <th className="px-3 py-2.5 text-right font-medium">Yıl</th>
              <th className="px-3 py-2.5 font-medium">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((book, index) => (
              <tr
                key={book.id}
                onClick={() => onOpen(book)}
                className={`cursor-pointer transition hover:bg-soft/60 ${selectedIds.has(book.id) ? 'bg-soft' : ''}`}
              >
                {canEdit && (
                  <td className="px-4 py-2.5" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`${book.title} seç`}
                      checked={selectedIds.has(book.id)}
                      onChange={() => onToggleSelect(book)}
                      className="h-4 w-4 accent-[#1a1a1a]"
                    />
                  </td>
                )}
                <td className="px-3 py-2.5 tabular-nums text-muted">{index + 1}</td>
                <td className="px-3 py-2.5 font-medium">{book.author || '—'}</td>
                <td className="px-3 py-2.5 font-serif">{book.title}</td>
                <td className="px-3 py-2.5 text-muted">{book.publisher || '—'}</td>
                <td className="px-3 py-2.5 text-muted">{book.genre || '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{book.pageCount || '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{book.publicationYear ?? '—'}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={book.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
