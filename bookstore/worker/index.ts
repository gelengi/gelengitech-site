/**
 * gelengitech.com Worker
 * - /bookstore/api/*  → Kitaplığım REST API (Cloudflare D1)
 * - diğer her şey     → statik site (Astro + bookstore derlemesi, ASSETS)
 *
 * Okuma uçları herkese açık; yazma uçları sahip girişi (Bearer token) ister.
 * Aynı API ileride mobil uygulama tarafından da kullanılacak (CORS açık, cookie yok).
 */
import {
  isReadingStatus,
  type Book,
  type BookInput,
  type LoginResponse,
  type ReadingStatus,
} from '../src/types';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** `wrangler secret put ADMIN_PASSWORD` */
  ADMIN_PASSWORD?: string;
  /** `wrangler secret put SESSION_SECRET` (uzun rastgele bir metin) */
  SESSION_SECRET?: string;
  /** İsteğe bağlı: `wrangler secret put GOOGLE_BOOKS_API_KEY` — kapak tanımada Google Books araması için */
  GOOGLE_BOOKS_API_KEY?: string;
}

const API_PREFIX = '/bookstore/api';
const TOKEN_TTL_DAYS = 30;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const COVER_HOSTS = new Set([
  'books.google.com',
  'books.googleusercontent.com',
  'covers.openlibrary.org',
]);

interface BookRow {
  id: number;
  title: string;
  author: string;
  publisher: string;
  page_count: number;
  genre: string;
  status: string;
  notes: string;
  publication_year: number | null;
  isbn: string | null;
  created_at: string;
  updated_at: string;
  cover_updated_at: string | null;
}

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------- helpers

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...CORS_HEADERS,
      ...extra,
    },
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

function rowToBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    publisher: row.publisher,
    pageCount: row.page_count,
    genre: row.genre,
    status: isReadingStatus(row.status) ? row.status : 'Okunmadı',
    notes: row.notes,
    publicationYear: row.publication_year ?? undefined,
    isbn: row.isbn ?? undefined,
    imageUrl: row.cover_updated_at
      ? `${API_PREFIX}/books/${row.id}/cover?v=${encodeURIComponent(row.cover_updated_at)}`
      : '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_BOOKS = `
  SELECT b.*, c.updated_at AS cover_updated_at
  FROM books b LEFT JOIN covers c ON c.book_id = b.id`;

async function getBook(env: Env, id: number): Promise<Book> {
  const row = await env.DB.prepare(`${SELECT_BOOKS} WHERE b.id = ?`).bind(id).first<BookRow>();
  if (!row) throw new HttpError(404, 'Kitap bulunamadı');
  return rowToBook(row);
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, 'Geçersiz JSON gövdesi');
  }
}

function str(value: unknown, field: string, max: number, required = false): string {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, `${field} zorunludur`);
    return '';
  }
  if (typeof value !== 'string') throw new HttpError(400, `${field} metin olmalıdır`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new HttpError(400, `${field} zorunludur`);
  if (trimmed.length > max) throw new HttpError(400, `${field} en fazla ${max} karakter olabilir`);
  return trimmed;
}

function int(value: unknown, field: string, min: number, max: number): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, `${field} ${min}–${max} arasında tam sayı olmalıdır`);
  }
  return n;
}

function cleanIsbn(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new HttpError(400, 'ISBN metin olmalıdır');
  const digits = value.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (digits.length !== 10 && digits.length !== 13) throw new HttpError(400, 'ISBN 10 veya 13 haneli olmalıdır');
  return digits;
}

interface CleanBook {
  title: string;
  author: string;
  publisher: string;
  pageCount: number;
  genre: string;
  status: ReadingStatus;
  notes: string;
  publicationYear: number | null;
  isbn: string | null;
}

function validateBook(input: Partial<BookInput>): CleanBook {
  const status = input.status ?? 'Okunmadı';
  if (!isReadingStatus(status)) throw new HttpError(400, 'Geçersiz okuma durumu');
  return {
    title: str(input.title, 'Kitap adı', 300, true),
    author: str(input.author, 'Yazar', 200),
    publisher: str(input.publisher, 'Yayınevi', 200),
    pageCount: int(input.pageCount, 'Sayfa sayısı', 0, 20000) ?? 0,
    genre: str(input.genre, 'Tür', 80),
    status,
    notes: str(input.notes, 'Notlar', 20000),
    publicationYear: int(input.publicationYear, 'Basım yılı', 0, new Date().getFullYear() + 1),
    isbn: cleanIsbn(input.isbn),
  };
}

function decodeDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match || !match[1] || !match[2]) throw new HttpError(400, 'Görsel JPEG/PNG/WebP data URL olmalıdır');
  const binary = atob(match[2]);
  if (binary.length > MAX_IMAGE_BYTES) throw new HttpError(413, 'Görsel çok büyük (en fazla 3 MB)');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { mime: match[1], bytes };
}

async function fetchRemoteCover(url: string): Promise<{ mime: string; bytes: Uint8Array }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError(400, 'Geçersiz kapak adresi');
  }
  if (!COVER_HOSTS.has(parsed.hostname)) throw new HttpError(400, 'Bu kaynaktan kapak indirilemez');
  parsed.protocol = 'https:';
  const response = await fetch(parsed.toString(), { headers: { 'User-Agent': 'gelengitech-bookstore/1.0' } });
  const mime = (response.headers.get('Content-Type') ?? '').split(';')[0]?.trim() ?? '';
  if (!response.ok || !mime.startsWith('image/')) throw new HttpError(502, 'Kapak görseli indirilemedi');
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new HttpError(413, 'Kapak görseli çok büyük');
  // Open Library, kapak yoksa 1x1 boş gif döndürür
  if (buffer.byteLength < 1000) throw new HttpError(404, 'Kaynakta kapak görseli yok');
  return { mime, bytes: new Uint8Array(buffer) };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function resolveCover(input: Partial<BookInput>): Promise<{ mime: string; bytes: Uint8Array } | null | undefined> {
  if (typeof input.image === 'string' && input.image) return decodeDataUrl(input.image);
  if (typeof input.coverUrl === 'string' && input.coverUrl) {
    try {
      return await fetchRemoteCover(input.coverUrl);
    } catch (error) {
      // İzinsiz alan adı gibi istemci hataları bildirilir; ağ sorunları kaydı engellemez (kitap kapaksız kaydedilir)
      if (error instanceof HttpError && error.status === 400) throw error;
      console.warn('Kapak indirilemedi', input.coverUrl, error);
      return undefined;
    }
  }
  if (input.image === null) return null; // kapağı kaldır
  return undefined; // değiştirme
}

function coverStatement(env: Env, bookId: number, cover: { mime: string; bytes: Uint8Array } | null): D1PreparedStatement {
  if (cover === null) return env.DB.prepare('DELETE FROM covers WHERE book_id = ?').bind(bookId);
  return env.DB.prepare(
    `INSERT INTO covers (book_id, mime, data, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(book_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at`,
  ).bind(bookId, cover.mime, toArrayBuffer(cover.bytes), nowIso());
}

function parseIds(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 1000) {
    throw new HttpError(400, 'ids 1–1000 elemanlı bir dizi olmalıdır');
  }
  return value.map((v) => {
    const n = int(v, 'id', 1, Number.MAX_SAFE_INTEGER);
    if (n === null) throw new HttpError(400, 'Geçersiz id');
    return n;
  });
}

// ---------------------------------------------------------------- auth

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64Url(new Uint8Array(signature));
}

async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

function requireSecrets(env: Env): { password: string; secret: string } {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    throw new HttpError(503, 'Sunucuda ADMIN_PASSWORD / SESSION_SECRET tanımlı değil');
  }
  return { password: env.ADMIN_PASSWORD, secret: env.SESSION_SECRET };
}

async function issueToken(env: Env): Promise<LoginResponse> {
  const { secret } = requireSecrets(env);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000).toISOString();
  const payload = base64Url(encoder.encode(JSON.stringify({ role: 'owner', exp: expiresAt })));
  return { token: `${payload}.${await hmac(secret, payload)}`, expiresAt };
}

async function isAuthenticated(request: Request, env: Env): Promise<boolean> {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !env.SESSION_SECRET) return false;
  if (!(await safeEqual(signature, await hmac(env.SESSION_SECRET, payload)))) return false;
  try {
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const data = JSON.parse(atob(padded)) as { exp?: string };
    return typeof data.exp === 'string' && Date.parse(data.exp) > Date.now();
  } catch {
    return false;
  }
}

async function requireAuth(request: Request, env: Env): Promise<void> {
  if (!(await isAuthenticated(request, env))) throw new HttpError(401, 'Bu işlem için giriş yapmalısınız');
}

// ---------------------------------------------------------------- Google Books vekili

async function googleBooksLookup(env: Env, rawQuery: string): Promise<{ items: unknown[] }> {
  const query = rawQuery.trim().slice(0, 200);
  if (!query) throw new HttpError(400, 'Arama metni gerekli');
  const params = new URLSearchParams({ q: query, maxResults: '10', printType: 'books' });
  if (env.GOOGLE_BOOKS_API_KEY) params.set('key', env.GOOGLE_BOOKS_API_KEY);
  let response: Response;
  try {
    response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`, { cf: { cacheTtlByStatus: { '200-299': 86400, '300-599': 0 }, cacheEverything: true } });
  } catch {
    throw new HttpError(502, 'Google Books’a ulaşılamadı');
  }
  if (response.status === 429) throw new HttpError(503, 'Google Books kotası dolu — GOOGLE_BOOKS_API_KEY tanımlayın');
  if (!response.ok) {
    // Google'ın kendi açıklamasını ilet (ör. "API key not valid", "API has not been used in project") — anahtar değeri içermez
    let detail = '';
    try {
      detail = ((await response.json()) as { error?: { message?: string } }).error?.message ?? '';
    } catch {
      // gövde JSON değil
    }
    throw new HttpError(502, `Google Books yanıt vermedi (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  const data = (await response.json()) as { items?: { volumeInfo?: unknown }[] };
  return { items: (data.items ?? []).flatMap((item) => (item.volumeInfo ? [item.volumeInfo] : [])) };
}

// ---------------------------------------------------------------- routes

async function handleApi(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  const segments = path.split('/').filter(Boolean); // ['books', '12', 'cover']

  // GET /health
  if (segments[0] === 'health' && method === 'GET') {
    return json({ ok: true, time: nowIso() });
  }

  // POST /auth/login  |  GET /auth/me
  if (segments[0] === 'auth') {
    if (segments[1] === 'login' && method === 'POST') {
      const { password } = requireSecrets(env);
      const body = await readJson<{ password?: unknown }>(request);
      const given = typeof body.password === 'string' ? body.password : '';
      if (!(await safeEqual(given, password))) {
        await new Promise((resolve) => setTimeout(resolve, 600)); // kaba kuvveti yavaşlat
        throw new HttpError(401, 'Şifre hatalı');
      }
      return json(await issueToken(env));
    }
    if (segments[1] === 'me' && method === 'GET') {
      return json({ authenticated: await isAuthenticated(request, env) });
    }
  }

  // GET /lookup?q=... — Google Books araması (yalnızca sahip; anahtar sunucuda kalır, mobil de kullanır)
  if (segments[0] === 'lookup' && segments.length === 1 && method === 'GET') {
    await requireAuth(request, env);
    return json(await googleBooksLookup(env, new URL(request.url).searchParams.get('q') ?? ''));
  }

  if (segments[0] !== 'books') throw new HttpError(404, 'Bulunamadı');

  // /books
  if (segments.length === 1) {
    if (method === 'GET') {
      const { results } = await env.DB.prepare(`${SELECT_BOOKS} ORDER BY b.created_at DESC, b.id DESC`).all<BookRow>();
      return json(results.map(rowToBook));
    }
    if (method === 'POST') {
      await requireAuth(request, env);
      const input = await readJson<Partial<BookInput>>(request);
      const book = validateBook(input);
      const cover = await resolveCover(input);
      const ts = nowIso();
      const inserted = await env.DB.prepare(
        `INSERT INTO books (title, author, publisher, page_count, genre, status, notes, publication_year, isbn, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
        .bind(book.title, book.author, book.publisher, book.pageCount, book.genre, book.status, book.notes, book.publicationYear, book.isbn, ts, ts)
        .first<{ id: number }>();
      if (!inserted) throw new HttpError(500, 'Kitap kaydedilemedi');
      if (cover) await coverStatement(env, inserted.id, cover).run();
      return json(await getBook(env, inserted.id), 201);
    }
  }

  // PATCH /books/status  { ids, status }
  if (segments.length === 2 && segments[1] === 'status' && method === 'PATCH') {
    await requireAuth(request, env);
    const body = await readJson<{ ids?: unknown; status?: unknown }>(request);
    const ids = parseIds(body.ids);
    if (!isReadingStatus(body.status)) throw new HttpError(400, 'Geçersiz okuma durumu');
    const ts = nowIso();
    await env.DB.batch(ids.map((id) => env.DB.prepare('UPDATE books SET status = ?, updated_at = ? WHERE id = ?').bind(body.status, ts, id)));
    return json({ updated: ids.length });
  }

  const id = /^\d{1,15}$/.test(segments[1] ?? '') ? Number(segments[1]) : null;
  if (id === null || id < 1) throw new HttpError(404, 'Bulunamadı');

  // GET /books/:id/cover
  if (segments.length === 3 && segments[2] === 'cover' && method === 'GET') {
    const row = await env.DB.prepare('SELECT mime, data FROM covers WHERE book_id = ?')
      .bind(id)
      .first<{ mime: string; data: ArrayBuffer | number[] }>();
    if (!row) throw new HttpError(404, 'Kapak yok');
    const body = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data).buffer;
    return new Response(body, {
      headers: {
        'Content-Type': row.mime,
        // URL'de ?v=<güncelleme zamanı> olduğu için uzun süre önbelleklenebilir
        'Cache-Control': 'public, max-age=31536000, immutable',
        ...CORS_HEADERS,
      },
    });
  }

  if (segments.length === 2) {
    if (method === 'GET') return json(await getBook(env, id));

    if (method === 'PUT') {
      await requireAuth(request, env);
      const existing = await getBook(env, id);
      const input = await readJson<Partial<BookInput>>(request);
      const merged: Partial<BookInput> = {
        title: existing.title,
        author: existing.author,
        publisher: existing.publisher,
        pageCount: existing.pageCount,
        genre: existing.genre,
        status: existing.status,
        notes: existing.notes,
        publicationYear: existing.publicationYear ?? null,
        isbn: existing.isbn ?? null,
        ...input,
      };
      const book = validateBook(merged);
      const cover = await resolveCover(input);
      const statements: D1PreparedStatement[] = [
        env.DB.prepare(
          `UPDATE books SET title = ?, author = ?, publisher = ?, page_count = ?, genre = ?, status = ?, notes = ?,
           publication_year = ?, isbn = ?, updated_at = ? WHERE id = ?`,
        ).bind(book.title, book.author, book.publisher, book.pageCount, book.genre, book.status, book.notes, book.publicationYear, book.isbn, nowIso(), id),
      ];
      if (cover !== undefined) statements.push(coverStatement(env, id, cover));
      await env.DB.batch(statements);
      return json(await getBook(env, id));
    }

    if (method === 'DELETE') {
      await requireAuth(request, env);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM covers WHERE book_id = ?').bind(id),
        env.DB.prepare('DELETE FROM books WHERE id = ?').bind(id),
      ]);
      return json({ deleted: id });
    }
  }

  throw new HttpError(405, 'Desteklenmeyen işlem');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === API_PREFIX || url.pathname.startsWith(`${API_PREFIX}/`)) {
      try {
        return await handleApi(request, env, url.pathname.slice(API_PREFIX.length));
      } catch (error) {
        if (error instanceof HttpError) return json({ error: error.message }, error.status);
        console.error(error);
        return json({ error: 'Sunucu hatası' }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
