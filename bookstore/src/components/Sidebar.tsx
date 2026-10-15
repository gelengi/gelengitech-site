// Filtreleme & istatistik yan paneli

import { useState, type ReactNode } from 'react';
import { Bookmark, BookmarkPlus, RotateCcw, Trash2 } from 'lucide-react';
import type { Book } from '../types';
import { READING_STATUSES } from '../types';
import { EMPTY_FILTERS, distinctValues, isFiltersEmpty, type Filters, type SavedFilter, type StatusFilter } from '../lib/filters';

interface SidebarProps {
  books: readonly Book[];
  filters: Filters;
  onChange: (filters: Filters) => void;
  savedFilters: readonly SavedFilter[];
  onSaveFilter: (name: string) => void;
  onDeleteFilter: (id: string) => void;
}

export function Sidebar({ books, filters, onChange, savedFilters, onSaveFilter, onDeleteFilter }: SidebarProps) {
  const [filterName, setFilterName] = useState('');
  const total = books.length;
  const readCount = books.filter((book) => book.status === 'Okundu').length;
  const readingCount = books.filter((book) => book.status === 'Okunuyor').length;
  const genres = distinctValues(books, 'genre');
  const authors = distinctValues(books, 'author');
  const publishers = distinctValues(books, 'publisher');
  const empty = isFiltersEmpty(filters);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });

  const save = () => {
    const name = filterName.trim();
    if (!name) return;
    onSaveFilter(name);
    setFilterName('');
  };

  return (
    <div className="space-y-6">
      {/* Sayaçlar */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Toplam" value={total} />
        <Stat label="Okunan" value={readCount} tone="text-read" />
        <Stat label="Okunuyor" value={readingCount} tone="text-reading" highlight />
      </div>
      {total > 0 && (
        <div className="-mt-3 h-1.5 overflow-hidden rounded-full bg-line" title={`%${Math.round((readCount / total) * 100)} okundu`}>
          <div className="flex h-full">
            <div className="bg-read" style={{ width: `${(readCount / total) * 100}%` }} />
            <div className="bg-reading/80" style={{ width: `${(readingCount / total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Okuma durumu */}
      <Section title="Okuma Durumu">
        <div className="grid grid-cols-2 gap-1.5">
          {(['Tümü', ...READING_STATUSES] as StatusFilter[]).map((status) => {
            const count = status === 'Tümü' ? total : books.filter((book) => book.status === status).length;
            const active = filters.status === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => set('status', status)}
                className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[13px] transition ${
                  active ? 'border-ink bg-ink text-paper' : 'border-line bg-white text-ink hover:border-accent/60'
                }`}
              >
                <span>{status}</span>
                <span className={`tabular-nums text-[11px] ${active ? 'text-paper/70' : 'text-muted'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Filtreler">
        <div className="space-y-3">
          <SelectField label="Tür" value={filters.genre} options={genres} onChange={(value) => set('genre', value)} />
          <SelectField label="Yazar" value={filters.author} options={authors} onChange={(value) => set('author', value)} />
          <SelectField label="Yayınevi" value={filters.publisher} options={publishers} onChange={(value) => set('publisher', value)} />
          <RangeField
            label="Sayfa Sayısı"
            min={filters.pageMin}
            max={filters.pageMax}
            onMin={(value) => set('pageMin', value)}
            onMax={(value) => set('pageMax', value)}
          />
          <RangeField
            label="Yayın Yılı"
            min={filters.yearMin}
            max={filters.yearMax}
            onMin={(value) => set('yearMin', value)}
            onMax={(value) => set('yearMax', value)}
          />
          <button type="button" className="btn-ghost w-full" onClick={() => onChange(EMPTY_FILTERS)} disabled={empty}>
            <RotateCcw size={15} />
            Filtreleri Sıfırla
          </button>
        </div>
      </Section>

      <Section title="Kayıtlı Filtreler">
        <div className="flex gap-1.5">
          <input
            className="field"
            placeholder={empty ? 'Önce filtre seçin' : 'Örn: Okunacak Klasikler'}
            value={filterName}
            disabled={empty}
            onChange={(event) => setFilterName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') save();
            }}
            maxLength={40}
          />
          <button type="button" className="btn-secondary shrink-0 px-2.5" onClick={save} disabled={empty || !filterName.trim()} aria-label="Filtreyi kaydet">
            <BookmarkPlus size={16} />
          </button>
        </div>
        {savedFilters.length === 0 ? (
          <p className="mt-2 text-xs text-muted">Sık kullandığınız filtre kombinasyonlarını kaydedin.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {savedFilters.map((saved) => (
              <li key={saved.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onChange(saved.filters)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition hover:bg-soft"
                >
                  <Bookmark size={14} className="shrink-0 text-accent" />
                  <span className="truncate">{saved.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteFilter(saved.id)}
                  className="icon-btn h-7 w-7 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label={`${saved.name} filtresini sil`}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Stat({ label, value, tone = 'text-ink', highlight = false }: { label: string; value: number; tone?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border px-2.5 py-2.5 ${highlight ? 'border-[#ecd7ad] bg-[#fbf3e4]' : 'border-line bg-white'}`}>
      <div className={`font-serif text-2xl font-semibold leading-none tabular-nums ${tone}`}>{value}</div>
      <div className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 font-serif text-[15px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Tümü</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function RangeField({ label, min, max, onMin, onMax }: { label: string; min: string; max: string; onMin: (value: string) => void; onMax: (value: string) => void }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-1.5">
        <input className="field" type="number" inputMode="numeric" min={0} placeholder="Min" value={min} onChange={(event) => onMin(event.target.value)} aria-label={`${label} en az`} />
        <span className="text-muted">–</span>
        <input className="field" type="number" inputMode="numeric" min={0} placeholder="Max" value={max} onChange={(event) => onMax(event.target.value)} aria-label={`${label} en çok`} />
      </div>
    </div>
  );
}
