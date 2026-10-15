// Kitap tanıma servisi — yapay zekâ (Gemini) KULLANMAZ.
//
// Akış:
//   1) Fotoğraflarda barkod ara (tarayıcının BarcodeDetector'ı, yoksa ZXing) → ISBN
//   2) Barkod yoksa ve OCR açıksa: künye sayfasında metin tanıma (tesseract.js, tur+eng) → ISBN
//   3) ISBN → Google Books, eksik alanlar Open Library ile tamamlanır
//   4) Hiçbiri bulunamazsa kullanıcı ISBN veya başlık/yazar ile arar ya da elle doldurur

import type { BookDetails } from '../types';
import { mapGenre } from '../lib/genres';
import { fileToCanvas, scaleCanvas } from './image';

// ------------------------------------------------------------------ ISBN yardımcıları

export function normalizeIsbn(raw: string): string | null {
  const cleaned = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (cleaned.length === 13 && isValidIsbn13(cleaned)) return cleaned;
  if (cleaned.length === 10 && isValidIsbn10(cleaned)) return isbn10To13(cleaned);
  return null;
}

function isValidIsbn13(isbn: string): boolean {
  if (!/^97[89]\d{10}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(isbn[12]);
}

function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const char = isbn[i] ?? '0';
    sum += (char === 'X' ? 10 : Number(char)) * (10 - i);
  }
  return sum % 11 === 0;
}

function isbn10To13(isbn10: string): string {
  const core = `978${isbn10.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  return `${core}${(10 - (sum % 10)) % 10}`;
}

/** OCR metninden ISBN yakalar ("ISBN 978-605-..." veya yalnızca 13 hane) */
export function findIsbnInText(text: string): string | null {
  const candidates = text.match(/(?:97[89][\s-]?)?(?:\d[\s-]?){9}[\dXx]/g) ?? [];
  for (const candidate of candidates) {
    const isbn = normalizeIsbn(candidate);
    if (isbn) return isbn;
  }
  return null;
}

// ------------------------------------------------------------------ Barkod

interface DetectedBarcodeLike {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcodeLike[]>;
}
interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

// ZXing yalnızca gerektiğinde yüklenir (ziyaretçiler bu paketi hiç indirmez)
type ZxingReader = InstanceType<typeof import('@zxing/browser')['BrowserMultiFormatReader']>;
let zxingReaderPromise: Promise<ZxingReader> | null = null;
function getZxingReader(): Promise<ZxingReader> {
  if (!zxingReaderPromise) {
    zxingReaderPromise = Promise.all([import('@zxing/browser'), import('@zxing/library')]).then(([browser, library]) => {
      const hints = new Map<import('@zxing/library').DecodeHintType, unknown>([
        [library.DecodeHintType.POSSIBLE_FORMATS, [library.BarcodeFormat.EAN_13, library.BarcodeFormat.EAN_8, library.BarcodeFormat.UPC_A]],
        [library.DecodeHintType.TRY_HARDER, true],
      ]);
      return new browser.BrowserMultiFormatReader(hints);
    });
    zxingReaderPromise.catch(() => {
      zxingReaderPromise = null;
    });
  }
  return zxingReaderPromise;
}

async function detectWithNative(canvas: HTMLCanvasElement): Promise<string | null> {
  const Ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const detector = new Ctor({ formats: ['ean_13', 'ean_8', 'upc_a'] });
    const results = await detector.detect(canvas);
    for (const result of results) {
      const isbn = normalizeIsbn(result.rawValue);
      if (isbn) return isbn;
    }
  } catch {
    // desteklenmiyor — ZXing'e düş
  }
  return null;
}

async function detectWithZxing(canvas: HTMLCanvasElement): Promise<string | null> {
  const reader = await getZxingReader();
  const attempts: HTMLCanvasElement[] = [canvas, scaleCanvas(canvas, 0.5), scaleCanvas(canvas, 0.75, true)];
  for (const attempt of attempts) {
    try {
      const result = reader.decodeFromCanvas(attempt);
      const isbn = normalizeIsbn(result.getText());
      if (isbn) return isbn;
    } catch {
      // bu ölçekte bulunamadı
    }
  }
  return null;
}

export async function detectIsbnBarcode(file: Blob): Promise<string | null> {
  const canvas = await fileToCanvas(file, 1800);
  return (await detectWithNative(canvas)) ?? (await detectWithZxing(canvas));
}

// ------------------------------------------------------------------ OCR (isteğe bağlı, tembel yüklenir)

type TesseractWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;
let ocrWorkerPromise: Promise<TesseractWorker> | null = null;

async function getOcrWorker(): Promise<TesseractWorker> {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = import('tesseract.js').then(({ createWorker }) => createWorker(['tur', 'eng']));
    ocrWorkerPromise.catch(() => {
      ocrWorkerPromise = null;
    });
  }
  return ocrWorkerPromise;
}

export async function recognizeText(file: Blob): Promise<string> {
  const worker = await getOcrWorker();
  const canvas = await fileToCanvas(file, 2000);
  const { data } = await worker.recognize(canvas);
  return data.text;
}

// ------------------------------------------------------------------ Çevrimiçi kaynaklar

interface GoogleVolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  categories?: string[];
  industryIdentifiers?: { type: string; identifier: string }[];
  imageLinks?: { thumbnail?: string; smallThumbnail?: string };
}
interface GoogleVolumesResponse {
  totalItems?: number;
  items?: { volumeInfo?: GoogleVolumeInfo }[];
}

function yearFrom(value: string | undefined): number | undefined {
  const match = value ? /(\d{4})/.exec(value) : null;
  return match?.[1] ? Number(match[1]) : undefined;
}

function googleToDetails(info: GoogleVolumeInfo): BookDetails {
  const isbn13 = info.industryIdentifiers?.find((id) => id.type === 'ISBN_13')?.identifier;
  const isbn10 = info.industryIdentifiers?.find((id) => id.type === 'ISBN_10')?.identifier;
  const thumb = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail;
  return {
    title: [info.title, info.subtitle].filter(Boolean).join(': ').trim(),
    author: (info.authors ?? []).join(', '),
    publisher: info.publisher ?? '',
    pageCount: info.pageCount ?? 0,
    genre: mapGenre(info.categories ?? []),
    publicationYear: yearFrom(info.publishedDate),
    isbn: normalizeIsbn(isbn13 ?? isbn10 ?? '') ?? undefined,
    coverUrl: thumb ? thumb.replace(/^http:/, 'https:').replace('&edge=curl', '') : undefined,
    source: 'Google Books',
  };
}

async function googleBooks(query: string, apiKey: string, maxResults = 1): Promise<BookDetails[]> {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults), printType: 'books' });
  if (apiKey) params.set('key', apiKey);
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`);
  if (!response.ok) throw new Error(`Google Books yanıt vermedi (${response.status})`);
  const data = (await response.json()) as GoogleVolumesResponse;
  return (data.items ?? []).flatMap((item) => (item.volumeInfo ? [googleToDetails(item.volumeInfo)] : []));
}

interface OpenLibraryBook {
  title?: string;
  subtitle?: string;
  authors?: { name: string }[];
  publishers?: { name: string }[];
  number_of_pages?: number;
  subjects?: { name: string }[];
  publish_date?: string;
  cover?: { large?: string; medium?: string };
}

async function openLibraryByIsbn(isbn: string): Promise<BookDetails | null> {
  const params = new URLSearchParams({ bibkeys: `ISBN:${isbn}`, format: 'json', jscmd: 'data' });
  const response = await fetch(`https://openlibrary.org/api/books?${params.toString()}`);
  if (!response.ok) return null;
  const data = (await response.json()) as Record<string, OpenLibraryBook | undefined>;
  const book = data[`ISBN:${isbn}`];
  if (!book) return null;
  return {
    title: [book.title, book.subtitle].filter(Boolean).join(': ').trim(),
    author: (book.authors ?? []).map((a) => a.name).join(', '),
    publisher: book.publishers?.[0]?.name ?? '',
    pageCount: book.number_of_pages ?? 0,
    genre: mapGenre((book.subjects ?? []).map((s) => s.name)),
    publicationYear: yearFrom(book.publish_date),
    isbn,
    coverUrl: book.cover?.large ?? book.cover?.medium ?? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
    source: 'Open Library',
  };
}

function mergeDetails(primary: BookDetails | null, secondary: BookDetails | null): BookDetails | null {
  if (!primary) return secondary;
  if (!secondary) return primary;
  return {
    ...primary,
    title: primary.title || secondary.title,
    author: primary.author || secondary.author,
    publisher: primary.publisher || secondary.publisher,
    pageCount: primary.pageCount || secondary.pageCount,
    genre: primary.genre || secondary.genre,
    publicationYear: primary.publicationYear ?? secondary.publicationYear,
    coverUrl: primary.coverUrl ?? secondary.coverUrl,
  };
}

/** ISBN ile kitap bilgisi — iki kaynağı birleştirir */
export async function lookupByIsbn(isbn: string, apiKey = ''): Promise<BookDetails | null> {
  const [google, openLibrary] = await Promise.allSettled([googleBooks(`isbn:${isbn}`, apiKey), openLibraryByIsbn(isbn)]);
  const g = google.status === 'fulfilled' ? (google.value[0] ?? null) : null;
  const o = openLibrary.status === 'fulfilled' ? openLibrary.value : null;
  const merged = mergeDetails(g, o);
  if (merged) merged.isbn = isbn;
  if (!merged && google.status === 'rejected' && openLibrary.status === 'rejected') {
    throw new Error('Kitap kaynaklarına ulaşılamadı');
  }
  return merged;
}

/** Başlık/yazar ile arama — kullanıcıya seçmesi için birkaç sonuç döner */
export async function searchBooks(title: string, author: string, apiKey = ''): Promise<BookDetails[]> {
  const parts: string[] = [];
  if (title.trim()) parts.push(`intitle:${title.trim()}`);
  if (author.trim()) parts.push(`inauthor:${author.trim()}`);
  if (parts.length === 0) return [];
  try {
    const results = await googleBooks(parts.join(' '), apiKey, 6);
    if (results.length > 0) return results;
  } catch {
    // Google kotası dolmuş olabilir (anahtarsız ortak kota) — Open Library'ye düş
  }
  return openLibrarySearch(title, author);
}

interface OpenLibrarySearchDoc {
  title?: string;
  subtitle?: string;
  author_name?: string[];
  publisher?: string[];
  number_of_pages_median?: number;
  first_publish_year?: number;
  isbn?: string[];
  subject?: string[];
  cover_i?: number;
}

async function openLibrarySearch(title: string, author: string): Promise<BookDetails[]> {
  const params = new URLSearchParams({ limit: '6', fields: 'title,subtitle,author_name,publisher,number_of_pages_median,first_publish_year,isbn,subject,cover_i' });
  if (title.trim()) params.set('title', title.trim());
  if (author.trim()) params.set('author', author.trim());
  const response = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);
  if (!response.ok) throw new Error(`Open Library yanıt vermedi (${response.status})`);
  const data = (await response.json()) as { docs?: OpenLibrarySearchDoc[] };
  return (data.docs ?? []).map((doc) => {
    const isbn = (doc.isbn ?? []).map((value) => normalizeIsbn(value)).find((value): value is string => value !== null);
    return {
      title: [doc.title, doc.subtitle].filter(Boolean).join(': ').trim(),
      author: (doc.author_name ?? []).join(', '),
      publisher: doc.publisher?.[0] ?? '',
      pageCount: doc.number_of_pages_median ?? 0,
      genre: mapGenre(doc.subject ?? []),
      publicationYear: doc.first_publish_year,
      isbn,
      coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : undefined,
      source: 'Open Library' as const,
    };
  });
}

// ------------------------------------------------------------------ Ana akış

export type AnalysisStep = 'barcode' | 'ocr' | 'lookup';

export interface AnalysisResult {
  isbn: string | null;
  details: BookDetails | null;
  /** Kullanıcıya gösterilecek kısa açıklama */
  message: string;
}

export interface AnalyzeOptions {
  ocrEnabled: boolean;
  apiKey: string;
  onStep?: (step: AnalysisStep) => void;
}

/** Bir kitaba ait fotoğrafları (ön/arka kapak, künye) inceleyip bilgileri çıkarır */
export async function analyzeBookPhotos(files: readonly Blob[], options: AnalyzeOptions): Promise<AnalysisResult> {
  let isbn: string | null = null;

  options.onStep?.('barcode');
  for (const file of files) {
    isbn = await detectIsbnBarcode(file);
    if (isbn) break;
  }

  if (!isbn && options.ocrEnabled) {
    options.onStep?.('ocr');
    // Künye sayfası genelde son fotoğraftır; sondan başa tara
    for (const file of [...files].reverse()) {
      isbn = findIsbnInText(await recognizeText(file));
      if (isbn) break;
    }
  }

  if (!isbn) {
    return {
      isbn: null,
      details: null,
      message: options.ocrEnabled
        ? 'Barkod veya ISBN bulunamadı. ISBN yazabilir ya da başlık/yazar ile arayabilirsiniz.'
        : 'Barkod bulunamadı. Künye sayfası için Ayarlar’dan OCR’ı açabilir ya da ISBN yazabilirsiniz.',
    };
  }

  options.onStep?.('lookup');
  let details: BookDetails | null;
  try {
    details = await lookupByIsbn(isbn, options.apiKey);
  } catch (error) {
    // ISBN bulundu ama kaynaklara ulaşılamadı — ISBN'i kaybetme
    return { isbn, details: null, message: `ISBN ${isbn} okundu; ancak ${error instanceof Error ? error.message.toLocaleLowerCase('tr') : 'kaynaklara ulaşılamadı'}. Daha sonra “Getir” ile tekrar deneyin.` };
  }
  return {
    isbn,
    details,
    message: details
      ? `ISBN ${isbn} — bilgiler ${details.source ?? 'çevrimiçi kaynaktan'} getirildi. Lütfen kontrol edin.`
      : `ISBN ${isbn} bulundu ama kaynaklarda kaydı yok. Bilgileri elle doldurun.`,
  };
}
