import { useState } from 'react';
import type { Book } from '../types';

/** Metinden kararlı bir sayı üretir (renk/yükseklik seçimi için) */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const PLACEHOLDER_TONES = [
  ['#3e2f25', '#6b5444'],
  ['#2f3b37', '#55675f'],
  ['#3a3046', '#62557a'],
  ['#4a2f2c', '#7c4f48'],
  ['#2d3a4a', '#4f6680'],
  ['#4a4130', '#7a6c4f'],
] as const;

interface BookCoverProps {
  book: Pick<Book, 'title' | 'author'>;
  src: string;
  className?: string;
}

/** Kapak görseli; yoksa veya yüklenemezse başlıklı zarif bir yer tutucu */
export function BookCover({ book, src, className = '' }: BookCoverProps) {
  const [failed, setFailed] = useState(false);
  const tone = PLACEHOLDER_TONES[hashString(book.title) % PLACEHOLDER_TONES.length] ?? PLACEHOLDER_TONES[0];

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`${book.title} kapağı`}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex h-full w-full flex-col justify-between p-[9%] text-left text-[#f6efe6] ${className}`}
      style={{ background: `linear-gradient(155deg, ${tone[1]}, ${tone[0]})` }}
      aria-label={`${book.title} (kapak yok)`}
    >
      <div className="h-px w-1/3 bg-[#f6efe6]/50" />
      <div>
        <p className="line-clamp-4 font-serif text-[clamp(0.8rem,1.1vw+0.4rem,1.15rem)] font-semibold leading-snug">{book.title}</p>
        {book.author && <p className="mt-1.5 line-clamp-2 text-[0.7rem] uppercase tracking-[0.12em] opacity-75">{book.author}</p>}
      </div>
    </div>
  );
}
