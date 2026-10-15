// 3B görünümlü ahşap kitaplık rafı — kitap sırtları, sayfa sayısına göre kalınlık, 4 tema

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { Library, X } from 'lucide-react';
import type { Book } from '../types';
import { sortByAuthorTitle } from '../lib/filters';
import { hashString } from './BookCover';

export type ShelfThemeId = 'classic' | 'modern' | 'minimal' | 'royal';

interface ShelfTheme {
  label: string;
  wall: string;
  board: string;
  boardEdge: string;
  boardShadow: string;
  light: string;
  spines: readonly string[];
  accentLine: string;
  title: string;
  frame: string;
}

export const SHELF_THEMES: Record<ShelfThemeId, ShelfTheme> = {
  classic: {
    label: 'Klasik',
    wall: 'radial-gradient(ellipse at 50% -10%, #4a2f17 0%, #2a1b0a 55%, #1a1006 100%)',
    board: 'linear-gradient(180deg, #5b3a24 0%, #3e2723 55%, #2c1b14 100%)',
    boardEdge: '#7a5236',
    boardShadow: '0 14px 18px -6px rgba(0,0,0,0.65)',
    light: 'radial-gradient(ellipse at 50% 0%, rgba(255,190,110,0.32), rgba(255,170,80,0) 70%)',
    spines: ['#6d1f1f', '#2f4a33', '#1f2f4a', '#7a5a2a', '#4a2a3a', '#8c6d46', '#3b2a1f', '#5a3b1e', '#2b3d3a', '#80331f'],
    accentLine: 'rgba(230,190,120,0.75)',
    title: '#f3e2c4',
    frame: '#2a1b0a',
  },
  modern: {
    label: 'Modern',
    wall: 'linear-gradient(180deg, #0f172a 0%, #0b1120 100%)',
    board: 'linear-gradient(180deg, #1e293b 0%, #111827 100%)',
    boardEdge: '#22d3ee',
    boardShadow: '0 0 16px rgba(34,211,238,0.35), 0 12px 16px -8px rgba(0,0,0,0.7)',
    light: 'radial-gradient(ellipse at 50% 0%, rgba(34,211,238,0.14), rgba(34,211,238,0) 70%)',
    spines: ['#334155', '#0e7490', '#4338ca', '#0f766e', '#9f1239', '#475569', '#155e75', '#3730a3', '#1e3a8a', '#52525b'],
    accentLine: 'rgba(103,232,249,0.8)',
    title: '#e2e8f0',
    frame: '#0f172a',
  },
  minimal: {
    label: 'Minimal',
    wall: 'linear-gradient(180deg, #f8f5f2 0%, #f1ece6 100%)',
    board: 'linear-gradient(180deg, #e9e2da 0%, #ddd4ca 100%)',
    boardEdge: '#f7f3ee',
    boardShadow: '0 10px 14px -8px rgba(80,60,40,0.35)',
    light: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.7), rgba(255,255,255,0) 70%)',
    spines: ['#e8dccd', '#cdbfae', '#b7a693', '#d9cfc2', '#a99a88', '#efe6da', '#c4b8a8', '#ddd2c3', '#9d8f7e', '#e3d6c4'],
    accentLine: 'rgba(120,100,80,0.45)',
    title: '#1a1a1a',
    frame: '#e9e2da',
  },
  royal: {
    label: 'Royal',
    wall: 'radial-gradient(ellipse at 50% -10%, #1c2f63 0%, #0d1a3d 55%, #070f26 100%)',
    board: 'linear-gradient(180deg, #172a5a 0%, #0d1a3d 100%)',
    boardEdge: '#d4af37',
    boardShadow: '0 12px 18px -6px rgba(0,0,0,0.7)',
    light: 'radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.22), rgba(212,175,55,0) 70%)',
    spines: ['#6b1d2a', '#123a2c', '#16244d', '#4b1d4f', '#7a1f2b', '#0f3d3e', '#2b1f5c', '#5c1a1a', '#1d3557', '#3f2b10'],
    accentLine: 'rgba(212,175,55,0.9)',
    title: '#f5e6b8',
    frame: '#070f26',
  },
};

/** Sayfa sayısına göre sırt kalınlığı (px) */
export function spineWidth(pageCount: number): number {
  if (!pageCount) return 26;
  return Math.round(Math.min(64, Math.max(16, 10 + pageCount * 0.06)));
}

function isLight(hex: string): boolean {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

const SHELF_PADDING = 20;
const SPINE_GAP = 2;

interface LibraryViewProps {
  open: boolean;
  books: readonly Book[];
  theme: ShelfThemeId;
  onThemeChange: (theme: ShelfThemeId) => void;
  onClose: () => void;
  onOpenBook: (book: Book) => void;
}

export function LibraryView({ open, books, theme, onThemeChange, onClose, onOpenBook }: LibraryViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const t = SHELF_THEMES[theme];
  const shelfHeight = width < 640 ? 190 : 240;

  useEffect(() => {
    if (!open) return;
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      observer.disconnect();
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  // Kitapları raflara yerleştir (açgözlü paketleme)
  const shelves = useMemo(() => {
    const ordered = sortByAuthorTitle(books);
    const available = Math.max(160, width - SHELF_PADDING * 2);
    const result: Book[][] = [];
    let current: Book[] = [];
    let used = 0;
    for (const book of ordered) {
      const w = spineWidth(book.pageCount) + SPINE_GAP;
      if (current.length > 0 && used + w > available) {
        result.push(current);
        current = [];
        used = 0;
      }
      current.push(book);
      used += w;
    }
    if (current.length > 0) result.push(current);
    // Boş kitaplık da raf gibi görünsün
    while (result.length < 3) result.push([]);
    return result;
  }, [books, width]);

  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col"
      style={{ background: t.wall }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="dialog"
      aria-modal="true"
      aria-label="Kitaplık rafı"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6" style={{ color: t.title }}>
        <div className="flex items-center gap-2.5">
          <Library size={20} />
          <h2 className="font-serif text-xl font-semibold">Kitaplığım</h2>
          <span className="text-sm opacity-70">{books.length} kitap</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-black/15 p-0.5 backdrop-blur" role="radiogroup" aria-label="Raf teması">
            {(Object.keys(SHELF_THEMES) as ShelfThemeId[]).map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={theme === id}
                onClick={() => onThemeChange(id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition sm:px-3 ${theme === id ? 'bg-white/90 text-[#1a1a1a] shadow' : 'opacity-80 hover:opacity-100'}`}
              >
                {SHELF_THEMES[id].label}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/15 backdrop-blur transition hover:bg-black/25">
            <X size={18} />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="scrollbar-thin flex-1 overflow-y-auto pb-10">
        <div className="mx-auto" style={{ padding: `8px ${SHELF_PADDING}px` }}>
          {shelves.map((shelf, shelfIndex) => (
            <div key={shelfIndex} className="relative mb-8">
              {/* raf içi ışık */}
              <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: shelfHeight, background: t.light }} />
              <div className="relative flex items-end" style={{ height: shelfHeight, gap: SPINE_GAP, perspective: '900px' }}>
                {shelf.map((book, index) => (
                  <Spine key={book.id} book={book} theme={t} shelfHeight={shelfHeight} delay={Math.min(index * 0.012, 0.4)} onClick={() => onOpenBook(book)} />
                ))}
              </div>
              {/* raf tahtası */}
              <div
                className="relative h-4 rounded-[3px]"
                style={{ background: t.board, boxShadow: t.boardShadow, borderTop: `2px solid ${t.boardEdge}` }}
              />
            </div>
          ))}
          {books.length === 0 && (
            <p className="text-center text-sm" style={{ color: t.title, opacity: 0.75 }}>
              Raflar boş — filtreleri değiştirin ya da kitap ekleyin.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface SpineProps {
  book: Book;
  theme: ShelfTheme;
  shelfHeight: number;
  delay: number;
  onClick: () => void;
}

function Spine({ book, theme, shelfHeight, delay, onClick }: SpineProps) {
  const hash = hashString(`${book.id}-${book.title}`);
  const color = theme.spines[hash % theme.spines.length] ?? '#555555';
  const width = spineWidth(book.pageCount);
  const height = Math.round(shelfHeight * (0.72 + ((hash >> 8) % 24) / 100));
  const light = isLight(color);
  const textColor = light ? '#2a2420' : '#f6efe4';
  const showAuthor = width >= 30 && book.author;

  const style: CSSProperties = {
    width,
    height,
    background: `linear-gradient(90deg, rgba(0,0,0,0.28) 0%, rgba(255,255,255,0.10) 18%, rgba(255,255,255,0) 40%, rgba(0,0,0,0.12) 85%, rgba(0,0,0,0.32) 100%), ${color}`,
    color: textColor,
    transformOrigin: 'bottom center',
  };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      title={`${book.title}${book.author ? ` — ${book.author}` : ''}`}
      className="relative flex shrink-0 flex-col items-center justify-between overflow-hidden rounded-t-[2px] py-2 shadow-[1px_0_2px_rgba(0,0,0,0.35)] outline-none focus-visible:ring-2 focus-visible:ring-white"
      style={style}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={{ y: -10, rotateY: -8 }}
    >
      <span className="h-[2px] w-full" style={{ background: theme.accentLine }} />
      <span className="spine-text flex min-h-0 flex-1 items-center gap-1.5 overflow-hidden px-0.5 py-2 text-center">
        {/* Dikey yazımda "inline" ekseni düşeydir: başlık önceliklidir, yazar kalan alana sığdığı kadar görünür */}
        <span
          className="shrink-0 truncate font-serif font-semibold leading-none"
          style={{ fontSize: Math.min(13, Math.max(9, width * 0.38)), maxInlineSize: '100%' }}
        >
          {book.title}
        </span>
        {showAuthor && (
          <span className="min-w-0 shrink truncate text-[9px] uppercase leading-none tracking-[0.1em] opacity-75" style={{ minInlineSize: 0 }}>
            {book.author}
          </span>
        )}
      </span>
      <span className="h-[2px] w-full" style={{ background: theme.accentLine }} />
    </motion.button>
  );
}
