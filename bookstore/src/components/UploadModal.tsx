// Tekli kitap ekleme / düzenleme — ön kapak fotoğrafından (OCR) bilgi çıkarma + çevrimiçi arama

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, ImagePlus, ScanSearch, Search, Star, Trash2, Wand2 } from 'lucide-react';
import type { Book, BookDetails, BookInput, ReadingStatus } from '../types';
import { READING_STATUSES } from '../types';
import { DEFAULT_GENRES } from '../lib/genres';
import { analyzeBookPhotos, searchBooks, type AnalysisStep, type RemoteSearch } from '../services/bookLookup';
import { compressImage } from '../services/image';
import { BookCover } from './BookCover';
import { Modal, Spinner, errorMessage } from './ui';

interface Photo {
  id: string;
  file: File;
  preview: string;
}

type CoverMode = 'photo' | 'online' | 'existing' | 'none';

interface FormState {
  title: string;
  author: string;
  publisher: string;
  pageCount: string;
  genre: string;
  publicationYear: string;
  status: ReadingStatus;
  notes: string;
  purchaseDate: string;
  purchasePlace: string;
  readingNote: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  author: '',
  publisher: '',
  pageCount: '',
  genre: '',
  publicationYear: '',
  status: 'Okunmadı',
  notes: '',
  purchaseDate: '',
  purchasePlace: '',
  readingNote: '',
};

const STEP_LABEL: Record<AnalysisStep, string> = {
  ocr: 'Kapak okunuyor… (ilk kullanımda dil verisi indirilir)',
  lookup: 'Kitap bilgileri aranıyor…',
};

interface UploadModalProps {
  open: boolean;
  book: Book | null; // null → yeni kitap
  existingCoverSrc: string;
  genres: readonly string[];
  library: readonly Book[];
  remote: RemoteSearch | null;
  onClose: () => void;
  onSubmit: (input: BookInput, bookId: number | null) => Promise<void>;
}

export function UploadModal({ open, book, existingCoverSrc, genres, library, remote, onClose, onSubmit }: UploadModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [coverMode, setCoverMode] = useState<CoverMode>('none');
  const [onlineCover, setOnlineCover] = useState('');
  const [step, setStep] = useState<AnalysisStep | null>(null);
  const [message, setMessage] = useState<{ tone: 'info' | 'success' | 'error'; text: string } | null>(null);
  const [results, setResults] = useState<BookDetails[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const photosRef = useRef<Photo[]>([]);
  photosRef.current = photos;

  // Modal her açıldığında formu hazırla
  useEffect(() => {
    if (!open) return;
    setForm(
      book
        ? {
            title: book.title,
            author: book.author,
            publisher: book.publisher,
            pageCount: book.pageCount ? String(book.pageCount) : '',
            genre: book.genre,
            publicationYear: book.publicationYear ? String(book.publicationYear) : '',
            status: book.status,
            notes: book.notes,
            purchaseDate: book.purchaseDate ?? '',
            purchasePlace: book.purchasePlace,
            readingNote: book.readingNote,
          }
        : EMPTY_FORM,
    );
    setPhotos([]);
    setCoverIndex(0);
    setCoverMode(book?.imageUrl ? 'existing' : 'none');
    setOnlineCover('');
    setStep(null);
    setMessage(null);
    setResults([]);
    setError('');
  }, [open, book]);

  // Önizleme URL'lerini serbest bırak
  useEffect(() => {
    if (!open) {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview));
    }
  }, [open]);
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview)), []);

  const busy = step !== null || saving;
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const images = [...list].filter((file) => file.type.startsWith('image/'));
    const added = images.slice(0, 8).map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) }));
    setPhotos((current) => [...current, ...added].slice(0, 8));
    if (coverMode !== 'online') setCoverMode('photo');
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      const next = current.filter((photo) => photo.id !== id);
      if (next.length === 0) setCoverMode(onlineCover ? 'online' : book?.imageUrl ? 'existing' : 'none');
      return next;
    });
    setCoverIndex(0);
  };

  const applyDetails = (details: BookDetails) => {
    setForm((current) => ({
      ...current,
      title: details.title || current.title,
      author: details.author || current.author,
      publisher: details.publisher || current.publisher,
      pageCount: details.pageCount ? String(details.pageCount) : current.pageCount,
      genre: details.genre || current.genre,
      publicationYear: details.publicationYear ? String(details.publicationYear) : current.publicationYear,
    }));
    if (details.coverUrl) {
      setOnlineCover(details.coverUrl);
      if (photos.length === 0 && coverMode !== 'existing') setCoverMode('online');
    }
    setResults([]);
  };

  const analyze = async () => {
    if (photos.length === 0) return;
    setMessage(null);
    setResults([]);
    try {
      // Kapak olarak seçilen fotoğraf (★) ön kapaktır — önce o okunur
      const ordered = [...photos.slice(coverIndex, coverIndex + 1), ...photos.filter((_, index) => index !== coverIndex)];
      const result = await analyzeBookPhotos(
        ordered.map((photo) => photo.file),
        { library, remote, onStep: setStep },
      );
      if (result.details) applyDetails(result.details);
      // Kendi ön kapak fotoğrafınız çevrimiçi küçük resimden daha net — kapak seçimi değişmez
      if (photos.length > 0) setCoverMode('photo');
      setResults(result.candidates);
      setMessage({ tone: result.matched ? 'success' : 'info', text: result.message });
    } catch (err) {
      setMessage({ tone: 'error', text: `Analiz başarısız: ${errorMessage(err)}` });
    } finally {
      setStep(null);
    }
  };

  const searchOnline = async () => {
    if (!form.title.trim() && !form.author.trim()) {
      setMessage({ tone: 'info', text: 'Aramak için başlık veya yazar yazın.' });
      return;
    }
    setSearching(true);
    setMessage(null);
    try {
      const found = await searchBooks(form.title, form.author, remote);
      setResults(found);
      if (found.length === 0) setMessage({ tone: 'info', text: 'Sonuç bulunamadı.' });
    } catch (err) {
      setMessage({ tone: 'error', text: errorMessage(err) });
    } finally {
      setSearching(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setError('Kitap adı zorunludur.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const input: BookInput = {
        title: form.title.trim(),
        author: form.author.trim(),
        publisher: form.publisher.trim(),
        pageCount: form.pageCount ? Number.parseInt(form.pageCount, 10) || 0 : 0,
        genre: form.genre.trim(),
        status: form.status,
        notes: form.notes,
        purchaseDate: form.purchaseDate || null,
        purchasePlace: form.purchasePlace.trim(),
        readingNote: form.readingNote.trim(),
        publicationYear: form.publicationYear ? Number.parseInt(form.publicationYear, 10) : null,
      };
      const coverPhoto = photos[coverIndex];
      if (coverMode === 'photo' && coverPhoto) input.image = await compressImage(coverPhoto.file);
      else if (coverMode === 'online' && onlineCover) input.coverUrl = onlineCover;
      else if (coverMode === 'none' && book?.imageUrl) input.image = null;
      await onSubmit(input, book?.id ?? null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const genreOptions = [...new Set([...genres, ...DEFAULT_GENRES])];
  // Daha önce girilen yerler öneri olarak gelir (aynı kitapçıyı tekrar yazmamak için)
  const placeOptions = [...new Set(library.map((item) => item.purchasePlace).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  const today = new Date().toISOString().slice(0, 10);
  const previewSrc =
    coverMode === 'photo' ? (photos[coverIndex]?.preview ?? '') : coverMode === 'online' ? onlineCover : coverMode === 'existing' ? existingCoverSrc : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={busy}
      size="lg"
      title={book ? 'Kitabı Düzenle' : 'Yeni Kitap Ekle'}
      subtitle={book ? book.title : 'Ön kapak fotoğrafını yükleyin; bilgiler kapaktan okunsun'}
      footer={
        <>
          {error && <p className="mr-auto text-sm text-danger">{error}</p>}
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Vazgeç
          </button>
          <button type="submit" form="book-form" className="btn-primary" disabled={busy}>
            {saving && <Spinner size={14} />}
            {book ? 'Değişiklikleri Kaydet' : 'Kitaplığa Ekle'}
          </button>
        </>
      }
    >
      <form id="book-form" onSubmit={submit} className="grid gap-6 px-5 py-5 sm:px-6 md:grid-cols-[minmax(0,240px)_1fr]">
        {/* Sol: fotoğraflar */}
        <div className="space-y-3">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded-md bg-soft shadow-md ring-1 ring-ink/5">
            <BookCover book={{ title: form.title || 'Kitap adı', author: form.author }} src={previewSrc} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondary px-2 text-[13px]" onClick={() => fileInput.current?.click()} disabled={busy}>
              <ImagePlus size={15} />
              Fotoğraf Seç
            </button>
            <button type="button" className="btn-secondary px-2 text-[13px]" onClick={() => cameraInput.current?.click()} disabled={busy}>
              <Camera size={15} />
              Kamera
            </button>
          </div>
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
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = '';
            }}
          />

          {photos.length > 0 && (
            <>
              <ul className="grid grid-cols-4 gap-1.5">
                {photos.map((photo, index) => (
                  <li key={photo.id} className="group relative aspect-[3/4] overflow-hidden rounded bg-soft ring-1 ring-line">
                    <img src={photo.preview} alt={`Fotoğraf ${index + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setCoverIndex(index);
                        setCoverMode('photo');
                      }}
                      title="Kapak olarak kullan"
                      className={`absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded ${
                        coverMode === 'photo' && coverIndex === index ? 'bg-ink text-[#f5c451]' : 'bg-white/85 text-muted'
                      }`}
                    >
                      <Star size={11} fill="currentColor" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      aria-label="Fotoğrafı kaldır"
                      className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded bg-white/85 text-danger"
                    >
                      <Trash2 size={11} />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn-primary w-full" onClick={analyze} disabled={busy}>
                {step && step !== 'lookup' ? <Spinner size={15} /> : <Wand2 size={15} />}
                Fotoğraflardan Bilgi Çıkar
              </button>
            </>
          )}

          {(onlineCover || book?.imageUrl || photos.length > 0) && (
            <div className="space-y-1 text-[13px]">
              <span className="label">Kapak</span>
              {photos.length > 0 && <CoverOption checked={coverMode === 'photo'} onChange={() => setCoverMode('photo')} label="Yüklediğim fotoğraf (★)" />}
              {onlineCover && <CoverOption checked={coverMode === 'online'} onChange={() => setCoverMode('online')} label="Çevrimiçi kapak" />}
              {book?.imageUrl && <CoverOption checked={coverMode === 'existing'} onChange={() => setCoverMode('existing')} label="Mevcut kapağı koru" />}
              <CoverOption checked={coverMode === 'none'} onChange={() => setCoverMode('none')} label="Kapaksız" />
            </div>
          )}

          <p className="text-xs leading-relaxed text-muted">
            İpucu: Ön kapağı <strong className="font-medium text-ink">düz, net ve tam kadraj</strong> çekin. Yazar kitaplığınızda varsa adı otomatik tanınır.
          </p>
        </div>

        {/* Sağ: form */}
        <div className="space-y-4">
          {(step || message) && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                step
                  ? 'border-line bg-soft text-ink'
                  : message?.tone === 'success'
                    ? 'border-[#c9dccf] bg-[#eaf2ec] text-read'
                    : message?.tone === 'error'
                      ? 'border-danger/30 bg-danger/5 text-danger'
                      : 'border-line bg-soft text-muted'
              }`}
              role="status"
            >
              {step ? <Spinner size={15} className="mt-0.5" /> : <ScanSearch size={16} className="mt-0.5 shrink-0" />}
              <span>{step ? STEP_LABEL[step] : message?.text}</span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="label">Kitap Adı *</span>
              <input className="field font-serif text-base" value={form.title} onChange={(event) => set('title', event.target.value)} required maxLength={300} />
            </label>
            <label className="block">
              <span className="label">Yazar</span>
              <input className="field" value={form.author} onChange={(event) => set('author', event.target.value)} maxLength={200} />
            </label>
            <label className="block">
              <span className="label">Yayınevi</span>
              <input className="field" value={form.publisher} onChange={(event) => set('publisher', event.target.value)} maxLength={200} />
            </label>
          </div>

          <div className="flex justify-end">
            <button type="button" className="btn-ghost -mt-1 px-2 py-1 text-[13px]" onClick={searchOnline} disabled={busy || searching}>
              {searching ? <Spinner size={14} /> : <Search size={14} />}
              Başlık/yazar ile çevrimiçi ara
            </button>
          </div>

          {results.length > 0 && (
            <ul className="scrollbar-thin -mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-line bg-white p-1.5">
              {results.map((result, index) => (
                <li key={`${result.title}-${result.author}-${index}`}>
                  <button type="button" onClick={() => applyDetails(result)} className="flex w-full items-center gap-3 rounded-md p-1.5 text-left transition hover:bg-soft">
                    <div className="h-14 w-10 shrink-0 overflow-hidden rounded-sm bg-soft">
                      <BookCover book={result} src={result.coverUrl ?? ''} />
                    </div>
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-serif font-semibold">{result.title}</p>
                      <p className="truncate text-xs text-muted">{[result.author, result.publisher, result.publicationYear].filter(Boolean).join(' · ')}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="col-span-2 block">
              <span className="label">Tür</span>
              <input className="field" list="genre-options" value={form.genre} onChange={(event) => set('genre', event.target.value)} maxLength={80} placeholder="Roman, Tarih…" />
              <datalist id="genre-options">
                {genreOptions.map((genre) => (
                  <option key={genre} value={genre} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="label">Sayfa</span>
              <input className="field" type="number" inputMode="numeric" min={0} max={20000} value={form.pageCount} onChange={(event) => set('pageCount', event.target.value)} />
            </label>
            <label className="block">
              <span className="label">Basım Yılı</span>
              <input className="field" type="number" inputMode="numeric" min={0} max={2100} value={form.publicationYear} onChange={(event) => set('publicationYear', event.target.value)} />
            </label>
          </div>

          <div>
            <span className="label">Okuma Durumu</span>
            <div className="grid grid-cols-3 gap-1.5">
              {READING_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => set('status', status)}
                  className={`rounded-lg border px-2 py-2 text-[13px] transition ${form.status === status ? 'border-ink bg-ink text-paper' : 'border-line bg-white hover:border-accent/60'}`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Ne Zaman Aldım</span>
              <input className="field" type="date" max={today} value={form.purchaseDate} onChange={(event) => set('purchaseDate', event.target.value)} />
            </label>
            <label className="block">
              <span className="label">Nereden Aldım</span>
              <input
                className="field"
                list="place-options"
                value={form.purchasePlace}
                onChange={(event) => set('purchasePlace', event.target.value)}
                maxLength={200}
                placeholder="Kitapçı, site, hediye…"
              />
              <datalist id="place-options">
                {placeOptions.map((place) => (
                  <option key={place} value={place} />
                ))}
              </datalist>
            </label>
          </div>

          <label className="block">
            <span className="label">Okuduktan Sonra Notum</span>
            <textarea
              className="field min-h-20 resize-y leading-relaxed"
              value={form.readingNote}
              onChange={(event) => set('readingNote', event.target.value)}
              maxLength={20000}
              placeholder={form.status === 'Okundu' ? 'Nasıldı? Kısa izlenimin, kime önerirsin…' : 'Okuyunca kısa izlenimini buraya yazabilirsin'}
            />
          </label>

          <label className="block">
            <span className="label">Notlar / Alıntılar</span>
            <textarea className="field min-h-24 resize-y leading-relaxed" value={form.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Kişisel notlarınız, sevdiğiniz alıntılar…" />
          </label>
        </div>
      </form>
    </Modal>
  );
}

function CoverOption({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="radio" name="cover-mode" checked={checked} onChange={onChange} className="accent-[#1a1a1a]" />
      {label}
    </label>
  );
}
