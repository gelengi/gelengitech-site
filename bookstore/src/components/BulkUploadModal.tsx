// Toplu fotoğraf yükleme — her fotoğraf bir kitap; kuyruk sırayla analiz edilir

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, ImagePlus, Save, Trash2, UploadCloud } from 'lucide-react';
import type { BookInput, ReadingStatus } from '../types';
import { READING_STATUSES } from '../types';
import { analyzeBookPhotos } from '../services/bookLookup';
import { compressImage } from '../services/image';
import { Modal, Spinner, errorMessage } from './ui';

type QueueStatus = 'pending' | 'processing' | 'completed' | 'error' | 'saving' | 'saved';

interface QueueItem {
  id: string;
  file: File;
  preview: string;
  status: QueueStatus;
  message: string;
  title: string;
  author: string;
  publisher: string;
  pageCount: number;
  genre: string;
  publicationYear?: number;
  isbn?: string;
  onlineCover?: string;
  useOnlineCover: boolean;
}

interface BulkUploadModalProps {
  open: boolean;
  ocrEnabled: boolean;
  apiKey: string;
  onClose: () => void;
  onSave: (input: BookInput) => Promise<void>;
}

const MAX_FILES = 60;

export function BulkUploadModal({ open, ocrEnabled, apiKey, onClose, onSave }: BulkUploadModalProps) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [defaultStatus, setDefaultStatus] = useState<ReadingStatus>('Okunmadı');
  const [running, setRunning] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<QueueItem[]>([]);
  itemsRef.current = items;
  // Modal kapandığında devam eden kuyruk döngüsünü geçersiz kılmak için nesil sayacı
  const generation = useRef(0);
  const runningRef = useRef(false);

  useEffect(() => {
    if (open) return;
    generation.current += 1;
    runningRef.current = false;
    itemsRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
    setItems([]);
    setRunning(false);
  }, [open]);

  const update = (id: string, patch: Partial<QueueItem>) => setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const processQueue = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    const myGeneration = generation.current;
    setRunning(true);
    try {
      for (;;) {
        if (generation.current !== myGeneration) return;
        const next = itemsRef.current.find((item) => item.status === 'pending');
        if (!next) break;
        update(next.id, { status: 'processing', message: 'Barkod aranıyor…' });
        try {
          const result = await analyzeBookPhotos([next.file], {
            ocrEnabled,
            apiKey,
            onStep: (step) => update(next.id, { message: step === 'barcode' ? 'Barkod aranıyor…' : step === 'ocr' ? 'OCR ile okunuyor…' : 'Bilgiler getiriliyor…' }),
          });
          if (result.details) {
            const d = result.details;
            update(next.id, {
              status: 'completed',
              message: `ISBN ${result.isbn ?? ''} · ${d.source ?? ''}`.trim(),
              title: d.title,
              author: d.author,
              publisher: d.publisher,
              pageCount: d.pageCount,
              genre: d.genre,
              publicationYear: d.publicationYear,
              isbn: result.isbn ?? d.isbn,
              onlineCover: d.coverUrl,
              // Barkod genelde arka kapakta → çevrimiçi kapak varsa onu tercih et
              useOnlineCover: Boolean(d.coverUrl),
            });
          } else {
            update(next.id, { status: 'error', message: result.message, isbn: result.isbn ?? undefined });
          }
        } catch (error) {
          update(next.id, { status: 'error', message: errorMessage(error) });
        }
      }
    } finally {
      if (generation.current === myGeneration) {
        runningRef.current = false;
        setRunning(false);
      }
    }
  };

  // Yeni öğe eklenince kuyruğu otomatik başlat
  useEffect(() => {
    // processQueue yalnızca öğe/çalışma durumu değişince tetiklenir (runningRef çift başlatmayı önler)
    if (open && !running && items.some((item) => item.status === 'pending')) void processQueue();
  }, [items, running, open]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const room = MAX_FILES - itemsRef.current.length;
    const files = [...list].filter((file) => file.type.startsWith('image/')).slice(0, Math.max(0, room));
    const added: QueueItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      status: 'pending',
      message: 'Sırada',
      title: '',
      author: '',
      publisher: '',
      pageCount: 0,
      genre: '',
      useOnlineCover: false,
    }));
    setItems((current) => [...current, ...added]);
  };

  const remove = (id: string) => {
    setItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((item) => item.id !== id);
    });
  };

  const saveItem = async (item: QueueItem): Promise<boolean> => {
    if (!item.title.trim()) {
      update(item.id, { message: 'Kaydetmek için kitap adı yazın' });
      return false;
    }
    update(item.id, { status: 'saving' });
    try {
      const input: BookInput = {
        title: item.title.trim(),
        author: item.author.trim(),
        publisher: item.publisher.trim(),
        pageCount: item.pageCount,
        genre: item.genre,
        status: defaultStatus,
        notes: '',
        publicationYear: item.publicationYear ?? null,
        isbn: item.isbn ?? null,
      };
      if (item.useOnlineCover && item.onlineCover) input.coverUrl = item.onlineCover;
      else input.image = await compressImage(item.file);
      await onSave(input);
      update(item.id, { status: 'saved', message: 'Kitaplığa eklendi' });
      return true;
    } catch (error) {
      update(item.id, { status: item.onlineCover || item.title ? 'completed' : 'error', message: `Kaydedilemedi: ${errorMessage(error)}` });
      return false;
    }
  };

  const saveAll = async () => {
    setSavingAll(true);
    try {
      for (const item of itemsRef.current) {
        if (item.status === 'completed' || (item.status === 'error' && item.title.trim())) await saveItem(item);
      }
    } finally {
      setSavingAll(false);
    }
  };

  const counts = {
    total: items.length,
    done: items.filter((item) => item.status !== 'pending' && item.status !== 'processing').length,
    ready: items.filter((item) => item.status === 'completed' || (item.status === 'error' && item.title.trim())).length,
    saved: items.filter((item) => item.status === 'saved').length,
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={savingAll}
      size="xl"
      title="Çoklu Kitap Ekle"
      subtitle="Her fotoğraf bir kitap sayılır. En iyi sonuç için arka kapaktaki barkodu çekin."
      footer={
        <>
          <label className="mr-auto flex items-center gap-2 text-sm text-muted">
            Kaydedilecek durum
            <select className="field w-auto py-1.5" value={defaultStatus} onChange={(event) => setDefaultStatus(event.target.value as ReadingStatus)}>
              {READING_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={savingAll}>
            {counts.saved > 0 ? 'Bitti' : 'Kapat'}
          </button>
          <button type="button" className="btn-primary" onClick={saveAll} disabled={savingAll || counts.ready === 0}>
            {savingAll ? <Spinner size={14} /> : <Save size={15} />}
            Tümünü Kaydet ({counts.ready})
          </button>
        </>
      }
    >
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            addFiles(event.dataTransfer.files);
          }}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
            dragOver ? 'border-accent bg-soft' : 'border-line bg-white hover:border-accent/60'
          }`}
        >
          <UploadCloud size={28} className="text-accent" />
          <span className="font-serif text-lg font-semibold">Fotoğrafları seçin veya buraya sürükleyin</span>
          <span className="text-xs text-muted">En fazla {MAX_FILES} fotoğraf · kuyruk sırayla otomatik analiz edilir</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />

        {items.length > 0 && (
          <>
            <div className="flex items-center gap-3 text-sm">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <div className="h-full bg-ink transition-all" style={{ width: `${(counts.done / counts.total) * 100}%` }} />
              </div>
              <span className="tabular-nums text-muted">
                {counts.done}/{counts.total} analiz · {counts.saved} kaydedildi
              </span>
              {running && <Spinner size={14} className="text-muted" />}
            </div>

            <ul className="grid gap-3 lg:grid-cols-2">
              {items.map((item) => (
                <QueueRow key={item.id} item={item} onChange={(patch) => update(item.id, patch)} onRemove={() => remove(item.id)} onSave={() => void saveItem(item)} disabled={savingAll} />
              ))}
            </ul>
          </>
        )}

        {items.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted">
            <ImagePlus size={16} />
            Henüz fotoğraf eklenmedi
          </div>
        )}
      </div>
    </Modal>
  );
}

interface QueueRowProps {
  item: QueueItem;
  disabled: boolean;
  onChange: (patch: Partial<QueueItem>) => void;
  onRemove: () => void;
  onSave: () => void;
}

function QueueRow({ item, disabled, onChange, onRemove, onSave }: QueueRowProps) {
  const editable = item.status === 'completed' || item.status === 'error';
  const statusIcon = {
    pending: <Clock size={14} className="text-muted" />,
    processing: <Spinner size={14} className="text-accent" />,
    completed: <CheckCircle2 size={14} className="text-read" />,
    error: <AlertCircle size={14} className="text-danger" />,
    saving: <Spinner size={14} className="text-ink" />,
    saved: <CheckCircle2 size={14} className="text-read" />,
  }[item.status];

  return (
    <li className={`flex gap-3 rounded-xl border bg-white p-2.5 ${item.status === 'saved' ? 'border-[#c9dccf] opacity-70' : 'border-line'}`}>
      <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded bg-soft">
        <img
          src={item.useOnlineCover && item.onlineCover ? item.onlineCover : item.preview}
          alt=""
          className="h-full w-full object-cover"
          onError={(event) => {
            // Çevrimiçi kapak yüklenemezse kendi fotoğrafına dön
            if (event.currentTarget.src !== item.preview) event.currentTarget.src = item.preview;
          }}
        />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start gap-1.5 text-xs">
          <span className="mt-px shrink-0">{statusIcon}</span>
          <span className={`line-clamp-2 ${item.status === 'error' ? 'text-danger' : 'text-muted'}`}>{item.message}</span>
        </div>
        {editable || item.status === 'saving' || item.status === 'saved' ? (
          <>
            <input
              className="field py-1.5 font-serif"
              placeholder="Kitap adı *"
              value={item.title}
              disabled={!editable || disabled}
              onChange={(event) => onChange({ title: event.target.value })}
            />
            <div className="flex gap-1.5">
              <input className="field py-1.5 text-[13px]" placeholder="Yazar" value={item.author} disabled={!editable || disabled} onChange={(event) => onChange({ author: event.target.value })} />
              <input className="field w-20 py-1.5 text-[13px]" placeholder="Tür" value={item.genre} disabled={!editable || disabled} onChange={(event) => onChange({ genre: event.target.value })} />
            </div>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              {item.onlineCover ? (
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" className="accent-[#1a1a1a]" checked={item.useOnlineCover} disabled={!editable} onChange={(event) => onChange({ useOnlineCover: event.target.checked })} />
                  Çevrimiçi kapak
                </label>
              ) : (
                <span />
              )}
              {editable && (
                <div className="flex gap-1">
                  <button type="button" className="icon-btn h-8 w-8" onClick={onRemove} aria-label="Kaldır" disabled={disabled}>
                    <Trash2 size={14} />
                  </button>
                  <button type="button" className="btn-secondary h-8 px-2.5 text-xs" onClick={onSave} disabled={disabled || !item.title.trim()}>
                    <Save size={13} />
                    Kaydet
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-1.5 pt-1">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
            {item.status === 'pending' && (
              <button type="button" className="btn-ghost -ml-2 px-2 py-1 text-xs" onClick={onRemove}>
                <Trash2 size={12} />
                Kuyruktan çıkar
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
