// Filtreleme motoru — arama + yan panel filtreleri

import type { Book, ReadingStatus } from '../types';

export type StatusFilter = 'Tümü' | ReadingStatus;

export interface Filters {
  status: StatusFilter;
  genre: string; // '' = tümü
  author: string;
  publisher: string;
  pageMin: string; // input değerleri metin olarak tutulur ('' = sınır yok)
  pageMax: string;
  yearMin: string;
  yearMax: string;
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: Filters;
}

export const EMPTY_FILTERS: Filters = {
  status: 'Tümü',
  genre: '',
  author: '',
  publisher: '',
  pageMin: '',
  pageMax: '',
  yearMin: '',
  yearMax: '',
};

export const trCollator = new Intl.Collator('tr', { sensitivity: 'base', numeric: true });

export function normalizeText(value: string): string {
  return value.toLocaleLowerCase('tr').normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

function toNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function isFiltersEmpty(filters: Filters): boolean {
  return (Object.keys(EMPTY_FILTERS) as (keyof Filters)[]).every((key) => filters[key] === EMPTY_FILTERS[key]);
}

export function applyFilters(books: readonly Book[], filters: Filters, search: string): Book[] {
  const query = normalizeText(search.trim());
  const pageMin = toNumber(filters.pageMin);
  const pageMax = toNumber(filters.pageMax);
  const yearMin = toNumber(filters.yearMin);
  const yearMax = toNumber(filters.yearMax);

  return books.filter((book) => {
    if (filters.status !== 'Tümü' && book.status !== filters.status) return false;
    if (filters.genre && book.genre !== filters.genre) return false;
    if (filters.author && book.author !== filters.author) return false;
    if (filters.publisher && book.publisher !== filters.publisher) return false;
    if (pageMin !== null && book.pageCount < pageMin) return false;
    if (pageMax !== null && book.pageCount > pageMax) return false;
    if (yearMin !== null && (book.publicationYear === undefined || book.publicationYear < yearMin)) return false;
    if (yearMax !== null && (book.publicationYear === undefined || book.publicationYear > yearMax)) return false;
    if (query) {
      const haystack = normalizeText(`${book.title} ${book.author} ${book.publisher} ${book.genre}`);
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

/** Veritabanındaki mevcut değerlerden benzersiz, alfabetik liste */
export function distinctValues(books: readonly Book[], key: 'genre' | 'author' | 'publisher'): string[] {
  const values = new Set<string>();
  for (const book of books) {
    const value = book[key].trim();
    if (value) values.add(value);
  }
  return [...values].sort(trCollator.compare);
}

export function sortByAuthorTitle(books: readonly Book[]): Book[] {
  return [...books].sort((a, b) => trCollator.compare(a.author, b.author) || trCollator.compare(a.title, b.title));
}
