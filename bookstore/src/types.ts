// Ortak tipler — hem web uygulaması hem Worker API tarafından kullanılır.
// İleride mobil uygulama da aynı sözleşmeyi (API yanıtlarını) kullanacak.

export const READING_STATUSES = ['Okunmadı', 'Okunuyor', 'Okundu'] as const;
export type ReadingStatus = (typeof READING_STATUSES)[number];

export interface Book {
  id: number;
  title: string; // Kitap adı
  author: string; // Yazar
  publisher: string; // Yayınevi
  pageCount: number; // Sayfa sayısı
  genre: string; // Tür (Roman, Tarih, Felsefe, Bilim vb.)
  imageUrl: string; // Kapak görseli URL'i (API: /bookstore/api/books/:id/cover?v=...) — yoksa ''
  status: ReadingStatus; // Okuma durumu
  notes: string; // Kişisel notlar / alıntılar
  publicationYear?: number; // Basım yılı
  isbn?: string; // ISBN-13 (varsa)
  createdAt: string; // ISO tarih
  updatedAt: string; // ISO tarih
}

export interface BookDetails {
  title: string;
  author: string;
  publisher: string;
  pageCount: number;
  genre: string;
  publicationYear?: number;
  isbn?: string;
  /** Çevrimiçi kaynaktan bulunan kapak görseli (Google Books / Open Library) */
  coverUrl?: string;
  /** Bilginin geldiği kaynak */
  source?: 'Google Books' | 'Open Library';
}

/** POST/PUT gövdesi */
export interface BookInput {
  title: string;
  author: string;
  publisher: string;
  pageCount: number;
  genre: string;
  status: ReadingStatus;
  notes: string;
  publicationYear?: number | null;
  isbn?: string | null;
  /** data:image/jpeg;base64,... — yeni kapak. null => kapağı kaldır, undefined => değiştirme */
  image?: string | null;
  /** Çevrimiçi kapak URL'i; sunucu indirip saklar (yalnızca izinli alan adları) */
  coverUrl?: string | null;
}

export interface ApiError {
  error: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
}

export function isReadingStatus(value: unknown): value is ReadingStatus {
  return typeof value === 'string' && (READING_STATUSES as readonly string[]).includes(value);
}

export function nextStatus(status: ReadingStatus): ReadingStatus {
  const index = READING_STATUSES.indexOf(status);
  return READING_STATUSES[(index + 1) % READING_STATUSES.length] ?? 'Okunmadı';
}
