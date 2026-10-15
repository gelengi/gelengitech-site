// Üst bar — logo, canlı arama, aksiyon butonları

import { Download, Layers, LockKeyhole, Plus, Search, Settings, X } from 'lucide-react';
import { Spinner } from './ui';

interface HeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  canEdit: boolean;
  backupBusy: boolean;
  onAdd: () => void;
  onBulkAdd: () => void;
  onBackup: () => void;
  onSettings: () => void;
}

export function Header({ search, onSearchChange, canEdit, backupBusy, onAdd, onBulkAdd, onBackup, onSettings }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:flex-nowrap">
        <a href="/" className="group flex shrink-0 items-baseline gap-2" title="gelengitech.com">
          <span className="font-serif text-2xl font-semibold tracking-tight sm:text-[28px]">Kitaplığım</span>
          <span className="hidden text-[11px] uppercase tracking-[0.18em] text-accent sm:inline">Gelengi</span>
        </a>

        <div className="order-3 w-full lg:order-none lg:mx-6 lg:max-w-xl lg:flex-1">
          <label className="relative block">
            <span className="sr-only">Kitaplarda ara</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Başlık, yazar, yayınevi veya tür ara…"
              className="field h-10 rounded-full pl-9 pr-9"
            />
            {search && (
              <button type="button" onClick={() => onSearchChange('')} className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-soft" aria-label="Aramayı temizle">
                <X size={14} />
              </button>
            )}
          </label>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          {canEdit && (
            <>
              <button type="button" className="btn-primary h-9 px-3" onClick={onAdd} title="Yeni kitap ekle">
                <Plus size={16} />
                <span className="hidden sm:inline">Yeni Ekle</span>
              </button>
              <button type="button" className="btn-secondary h-9 px-3" onClick={onBulkAdd} title="Çoklu fotoğraf ile ekle">
                <Layers size={16} />
                <span className="hidden md:inline">Çoklu Ekle</span>
              </button>
              <button type="button" className="icon-btn" onClick={onBackup} disabled={backupBusy} title="Fotoğrafları yedekle (ZIP)" aria-label="Fotoğrafları yedekle">
                {backupBusy ? <Spinner size={17} /> : <Download size={18} />}
              </button>
            </>
          )}
          <button type="button" className="icon-btn" onClick={onSettings} title={canEdit ? 'Ayarlar' : 'Sahip girişi ve ayarlar'} aria-label="Ayarlar">
            {canEdit ? <Settings size={18} /> : <LockKeyhole size={17} />}
          </button>
        </div>
      </div>
    </header>
  );
}
