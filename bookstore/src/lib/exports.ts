// Dışa aktarma: Excel (.xlsx) ve kapak fotoğrafları yedeği (.zip)

import type { Book } from '../types';
import { sortByAuthorTitle } from './filters';

function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportToExcel(books: readonly Book[]): Promise<void> {
  const XLSX = await import('xlsx');
  const rows = sortByAuthorTitle(books).map((book, index) => ({
    '#': index + 1,
    Yazar: book.author,
    'Kitap Adı': book.title,
    Yayınevi: book.publisher,
    Tür: book.genre,
    'Sayfa Sayısı': book.pageCount || '',
    'Basım Yılı': book.publicationYear ?? '',
    Durum: book.status,
    Notlar: book.notes,
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0] ?? { '#': '' });
  // Otomatik kolon genişliği (en uzun hücreye göre, 60 karakterle sınırlı)
  sheet['!cols'] = headers.map((header) => {
    const longest = rows.reduce((max, row) => {
      const value = (row as Record<string, unknown>)[header];
      return Math.max(max, String(value ?? '').length);
    }, header.length);
    return { wch: Math.min(60, longest + 2) };
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Kitaplığım');
  const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  triggerDownload(
    new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `kitapligim_${todayStamp()}.xlsx`,
  );
}

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'kitap';
}

/** Tüm kapakları bookstore_photos_TARIH.zip olarak indirir (books.json ile birlikte) */
export async function backupPhotos(
  books: readonly Book[],
  coverUrl: (book: Book) => string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ photos: number; failed: number }> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const folder = zip.folder('kapaklar') ?? zip;
  const withCovers = books.filter((book) => book.imageUrl);
  let photos = 0;
  let failed = 0;

  for (let i = 0; i < withCovers.length; i++) {
    const book = withCovers[i];
    if (!book) continue;
    try {
      const response = await fetch(coverUrl(book));
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
      folder.file(`${book.id} - ${safeFileName(`${book.author} - ${book.title}`)}.${ext}`, blob);
      photos++;
    } catch {
      failed++;
    }
    onProgress?.(i + 1, withCovers.length);
  }

  zip.file('books.json', JSON.stringify(books, null, 2));
  const content = await zip.generateAsync({ type: 'blob' });
  triggerDownload(content, `bookstore_photos_${todayStamp()}.zip`);
  return { photos, failed };
}
