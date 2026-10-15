// Veri servisi — Kitaplığım REST API istemcisi (Cloudflare Worker + D1).
// Mobil uygulama da aynı uç noktaları kullanacak; sözleşme src/types.ts içinde.

import type { ApiError, Book, BookInput, LoginResponse, ReadingStatus } from '../types';
import type { GoogleVolumeInfo } from './bookLookup';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface DbClient {
  listBooks(): Promise<Book[]>;
  createBook(input: BookInput): Promise<Book>;
  updateBook(id: number, input: Partial<BookInput>): Promise<Book>;
  deleteBook(id: number): Promise<void>;
  setStatus(ids: number[], status: ReadingStatus): Promise<void>;
  login(password: string): Promise<LoginResponse>;
  checkSession(): Promise<boolean>;
  /** Google Books araması (yalnızca sahip; API anahtarı sunucuda) */
  lookup(query: string): Promise<GoogleVolumeInfo[]>;
  coverUrl(book: Book): string;
}

function isApiError(value: unknown): value is ApiError {
  return typeof value === 'object' && value !== null && typeof (value as ApiError).error === 'string';
}

export function createDbClient(apiBase: string, getToken: () => string): DbClient {
  const base = apiBase.replace(/\/+$/, '');
  // imageUrl API'den "/bookstore/api/books/1/cover?v=..." olarak gelir; harici apiBase için kökü ona göre kur
  const origin = /^https?:\/\//.test(base) ? new URL(base).origin : '';

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body) headers.set('Content-Type', 'application/json');
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let response: Response;
    try {
      response = await fetch(`${base}${path}`, { ...init, headers });
    } catch {
      throw new ApiRequestError(0, 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.');
    }

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        data = null;
      }
    }
    if (!response.ok) {
      const message = isApiError(data) ? data.error : `İstek başarısız (${response.status})`;
      throw new ApiRequestError(response.status, message);
    }
    return data as T;
  }

  return {
    listBooks: () => request<Book[]>('/books'),
    createBook: (input) => request<Book>('/books', { method: 'POST', body: JSON.stringify(input) }),
    updateBook: (id, input) => request<Book>(`/books/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    deleteBook: async (id) => {
      await request<unknown>(`/books/${id}`, { method: 'DELETE' });
    },
    setStatus: async (ids, status) => {
      await request<unknown>('/books/status', { method: 'PATCH', body: JSON.stringify({ ids, status }) });
    },
    login: (password) => request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
    checkSession: async () => (await request<{ authenticated: boolean }>('/auth/me')).authenticated,
    lookup: async (query) => (await request<{ items: GoogleVolumeInfo[] }>(`/lookup?q=${encodeURIComponent(query)}`)).items,
    coverUrl: (book) => (book.imageUrl ? `${origin}${book.imageUrl}` : ''),
  };
}
