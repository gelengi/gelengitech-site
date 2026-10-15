// Kitap tanıma servisi — yapay zekâ servisi KULLANMAZ.
//
// Akış (ön kapak fotoğrafı):
//   1) Kapaktaki yazılar tarayıcıda okunur (tesseract.js, tur+eng, seyrek metin modu, iki ön işleme)
//   2) Yazar ve yayınevi önce kendi kitaplığındaki adlarla eşleştirilir; kalan büyük puntolu kelimeler başlık tahmini olur
//   3) Tahminle Google Books (Worker üzerinden, API anahtarı sunucuda) ve Open Library'de aranır
//   4) Kapakla en iyi uyuşan sonuç seçilir; yoksa kapaktan okunan tahmin forma yazılır, kullanıcı düzeltir

import type { Book, BookDetails } from '../types';
import { mapGenre } from '../lib/genres';
import { guessFromCover, mergeWords, scoreCandidate, fold, type CoverGuess, type OcrWord } from '../lib/coverText';
import { fileToCanvas } from './image';

// ------------------------------------------------------------------ OCR (tembel yüklenir)

type TesseractWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;
let ocrWorkerPromise: Promise<TesseractWorker> | null = null;

async function getOcrWorker(): Promise<TesseractWorker> {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = import('tesseract.js').then(async ({ createWorker, PSM }) => {
      const worker = await createWorker(['tur', 'eng']);
      // Kapaklarda metin dağınık ve farklı puntolarda: seyrek metin modu çok daha iyi sonuç veriyor
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      return worker;
    });
    ocrWorkerPromise.catch(() => {
      ocrWorkerPromise = null;
    });
  }
  return ocrWorkerPromise;
}

/** Gri ton; `binary` ise kontrast germe + eşikleme (açık zemin/koyu yazı ve tersi için) */
function preprocess(source: HTMLCanvasElement, binary: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  const luminance = new Uint8ClampedArray(pixels.length / 4);
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    const value = Math.round(0.299 * (pixels[i] ?? 0) + 0.587 * (pixels[i + 1] ?? 0) + 0.114 * (pixels[i + 2] ?? 0));
    luminance[p] = value;
    histogram[value] = (histogram[value] ?? 0) + 1;
  }
  let low = 0;
  let high = 255;
  if (binary) {
    // %1–%99 aralığını tam aralığa ger
    const total = luminance.length;
    let sum = 0;
    for (let v = 0; v < 256; v++) {
      sum += histogram[v] ?? 0;
      if (sum >= total * 0.01) {
        low = v;
        break;
      }
    }
    sum = 0;
    for (let v = 255; v >= 0; v--) {
      sum += histogram[v] ?? 0;
      if (sum >= total * 0.01) {
        high = v;
        break;
      }
    }
  }
  const range = Math.max(1, high - low);
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    let value = luminance[p] ?? 0;
    if (binary) value = ((value - low) * 255) / range >= 128 ? 255 : 0;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = value;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** OCR sonuçları tek bir koordinat sistemine (uzun kenar = 1000) çevrilir ki farklı ölçekler birleşebilsin */
const REFERENCE_SIDE = 1000;
/** Kapak yazıları her ölçekte farklı okunuyor; iki ölçek × iki ön işleme = dört geçiş birleştirilir */
const OCR_SIDES = [1000, 1600] as const;

/** Bir kapak fotoğrafındaki kelimeleri konum ve güven skoruyla döner */
export async function readCoverWords(file: Blob): Promise<OcrWord[]> {
  const worker = await getOcrWorker();
  const passes: OcrWord[][] = [];
  for (const side of OCR_SIDES) {
    const base = await fileToCanvas(file, side);
    const factor = REFERENCE_SIDE / Math.max(base.width, base.height);
    for (const binary of [false, true]) {
      const { data } = await worker.recognize(preprocess(base, binary), {}, { blocks: true });
      const words: OcrWord[] = [];
      for (const block of data.blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            for (const word of line.words) {
              const { x0, y0, x1, y1 } = word.bbox;
              words.push({ text: word.text, confidence: word.confidence, bbox: { x0: x0 * factor, y0: y0 * factor, x1: x1 * factor, y1: y1 * factor } });
            }
          }
        }
      }
      passes.push(words);
    }
  }
  return mergeWords(passes);
}

// ------------------------------------------------------------------ Çevrimiçi kaynaklar

export interface GoogleVolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  categories?: string[];
  imageLinks?: { thumbnail?: string; smallThumbnail?: string };
}

/** Google Books araması — Worker üzerinden (anahtar sunucuda). Ulaşılamazsa hata fırlatır. */
export type RemoteSearch = (query: string) => Promise<GoogleVolumeInfo[]>;

function yearFrom(value: string | undefined): number | undefined {
  const match = value ? /(\d{4})/.exec(value) : null;
  return match?.[1] ? Number(match[1]) : undefined;
}

export function googleToDetails(info: GoogleVolumeInfo): BookDetails {
  const thumb = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail;
  return {
    title: [info.title, info.subtitle].filter(Boolean).join(': ').trim(),
    author: (info.authors ?? []).join(', '),
    publisher: info.publisher ?? '',
    pageCount: info.pageCount ?? 0,
    genre: mapGenre(info.categories ?? []),
    publicationYear: yearFrom(info.publishedDate),
    coverUrl: thumb ? thumb.replace(/^http:/, 'https:').replace('&edge=curl', '') : undefined,
    source: 'Google Books',
  };
}

interface OpenLibrarySearchDoc {
  title?: string;
  subtitle?: string;
  author_name?: string[];
  publisher?: string[];
  number_of_pages_median?: number;
  first_publish_year?: number;
  subject?: string[];
  cover_i?: number;
}

async function openLibrarySearch(params: Record<string, string>): Promise<BookDetails[]> {
  const search = new URLSearchParams({
    limit: '8',
    fields: 'title,subtitle,author_name,publisher,number_of_pages_median,first_publish_year,subject,cover_i',
    ...params,
  });
  const response = await fetch(`https://openlibrary.org/search.json?${search.toString()}`);
  if (!response.ok) throw new Error(`Open Library yanıt vermedi (${response.status})`);
  const data = (await response.json()) as { docs?: OpenLibrarySearchDoc[] };
  return (data.docs ?? []).map((doc) => ({
    title: [doc.title, doc.subtitle].filter(Boolean).join(': ').trim(),
    author: (doc.author_name ?? []).join(', '),
    publisher: doc.publisher?.[0] ?? '',
    pageCount: doc.number_of_pages_median ?? 0,
    genre: mapGenre(doc.subject ?? []),
    publicationYear: doc.first_publish_year,
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : undefined,
    source: 'Open Library' as const,
  }));
}

/** Serbest metinle arama: önce Google Books, olmazsa Open Library. Tekrarlar ayıklanır. */
async function searchAll(queries: readonly string[], remote: RemoteSearch | null): Promise<BookDetails[]> {
  const found: BookDetails[] = [];
  let googleWorks = remote !== null;
  for (const query of queries) {
    if (googleWorks && remote) {
      try {
        found.push(...(await remote(query)).map(googleToDetails));
        continue;
      } catch {
        googleWorks = false; // kota/erişim sorunu — kalan sorgularda Open Library kullan
      }
    }
    try {
      found.push(...(await openLibrarySearch({ q: query })));
    } catch {
      // tek sorgunun başarısızlığı akışı durdurmaz
    }
  }
  const seen = new Set<string>();
  return found.filter((book) => {
    const key = `${fold(book.title)}|${fold(book.author)}`;
    if (!book.title || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Başlık/yazar ile elle arama — formdaki "çevrimiçi ara" düğmesi */
export async function searchBooks(title: string, author: string, remote: RemoteSearch | null): Promise<BookDetails[]> {
  const parts: string[] = [];
  if (title.trim()) parts.push(`intitle:${title.trim()}`);
  if (author.trim()) parts.push(`inauthor:${author.trim()}`);
  if (parts.length === 0) return [];
  if (remote) {
    try {
      const results = (await remote(parts.join(' '))).map(googleToDetails);
      if (results.length > 0) return results.slice(0, 8);
    } catch {
      // Open Library'ye düş
    }
  }
  const params: Record<string, string> = {};
  if (title.trim()) params.title = title.trim();
  if (author.trim()) params.author = author.trim();
  return openLibrarySearch(params);
}

// ------------------------------------------------------------------ Ana akış

export type AnalysisStep = 'ocr' | 'lookup';

export interface AnalysisResult {
  /** Forma yazılacak en iyi bilgi (çevrimiçi eşleşme veya kapaktan tahmin) */
  details: BookDetails | null;
  /** Eşleşme kesin değilse kullanıcının seçebileceği adaylar */
  candidates: BookDetails[];
  /** Çevrimiçi kaynakta kapakla uyuşan kayıt bulundu mu */
  matched: boolean;
  guess: CoverGuess | null;
  message: string;
}

export interface AnalyzeOptions {
  library: readonly Book[];
  remote: RemoteSearch | null;
  onStep?: (step: AnalysisStep) => void;
}

const MATCH_THRESHOLD = 0.6;

/** Yazarın kitaplıktaki en sık türü — çevrimiçi kaynak tür vermezse kullanılır */
function genreFromLibrary(author: string, library: readonly Book[]): string {
  const surname = fold(author.split(/[,&]/)[0]?.trim().split(/\s+/).pop() ?? '');
  if (!surname) return '';
  const counts = new Map<string, number>();
  for (const book of library) {
    if (book.genre && fold(book.author).includes(surname)) counts.set(book.genre, (counts.get(book.genre) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

/** Kapak fotoğraf(lar)ından kitap bilgisi çıkarır. İlk fotoğraf ön kapak kabul edilir. */
export async function analyzeBookPhotos(files: readonly Blob[], options: AnalyzeOptions): Promise<AnalysisResult> {
  options.onStep?.('ocr');
  const words: OcrWord[] = [];
  for (const file of files.slice(0, 3)) words.push(...(await readCoverWords(file)));

  const hints = {
    authors: [...new Set(options.library.map((book) => book.author).filter(Boolean))],
    publishers: [...new Set(options.library.map((book) => book.publisher).filter(Boolean))],
  };
  const guess = guessFromCover(words, hints);
  if (!guess.title && !guess.author) {
    return { details: null, candidates: [], matched: false, guess, message: 'Kapakta okunabilir yazı bulunamadı. Bilgileri elle girin veya başlıkla arayın.' };
  }

  options.onStep?.('lookup');
  const queries = [...new Set([guess.query, [guess.title, guess.author ?? ''].join(' ').trim(), guess.narrowQuery].filter((query) => query.length >= 3))];
  const found = await searchAll(queries, options.remote);
  const ranked = found
    .map((book) => ({ book, score: scoreCandidate(book, guess) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];

  if (best && best.score >= MATCH_THRESHOLD) {
    const details: BookDetails = {
      ...best.book,
      title: best.book.title.split(':')[0]?.trim() || best.book.title,
      publisher: best.book.publisher || guess.publisher || '',
      genre: best.book.genre || genreFromLibrary(best.book.author, options.library),
    };
    return {
      details,
      candidates: ranked.slice(1, 6).filter((item) => item.score >= 0.4).map((item) => item.book),
      matched: true,
      guess,
      message: `${details.source ?? 'Çevrimiçi kaynak'} ile eşleşti. Lütfen kontrol edin.`,
    };
  }

  // Kesin eşleşme yok → kapaktan okunan tahmin
  const author = guess.author ?? '';
  return {
    details: {
      title: guess.title,
      author,
      publisher: guess.publisher ?? '',
      pageCount: 0,
      genre: author ? genreFromLibrary(author, options.library) : '',
    },
    candidates: ranked.slice(0, 5).map((item) => item.book),
    matched: false,
    guess,
    message:
      ranked.length > 0
        ? 'Kapaktan okunan tahmin yazıldı; aşağıdaki sonuçlardan biri doğruysa seçin.'
        : 'Kapaktan okunan tahmin yazıldı; çevrimiçi kayıt bulunamadı. Lütfen kontrol edin.',
  };
}
