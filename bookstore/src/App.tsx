import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BookPlus, LayoutGrid, Library, List, RefreshCw, SearchX, SlidersHorizontal, WifiOff, ZoomIn, ZoomOut } from 'lucide-react';
import type { Book, BookInput, ReadingStatus } from './types';
import { nextStatus } from './types';
import { ApiRequestError, createDbClient } from './services/db';
import { PREF_KEYS, loadConfig, readJsonStorage, saveConfig, writeJsonStorage, type AppConfig } from './services/config';
import { EMPTY_FILTERS, applyFilters, distinctValues, isFiltersEmpty, type Filters, type SavedFilter } from './lib/filters';
import { backupPhotos } from './lib/exports';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { BookCard } from './components/BookCard';
import { LibraryView, SHELF_THEMES, type ShelfThemeId } from './components/LibraryView';
import { ListView } from './components/ListView';
import { UploadModal } from './components/UploadModal';
import { BulkUploadModal } from './components/BulkUploadModal';
import { SettingsModal } from './components/SettingsModal';
import { BookDetailModal } from './components/BookDetailModal';
import { BulkBar } from './components/BulkBar';
import { ConfirmDialog, Modal, errorMessage, useToast } from './components/ui';

type ViewMode = 'grid' | 'list';

const ZOOM_MIN = 0.75;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.125;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function App() {
  const toast = useToast();

  // ------------------------------------------------------------ ayarlar & API
  const [config, setConfig] = useState<AppConfig>(() => loadConfig());
  const tokenRef = useRef(config.authToken);
  tokenRef.current = config.authToken;
  const db = useMemo(() => createDbClient(config.apiBase, () => tokenRef.current), [config.apiBase]);
  const canEdit = Boolean(config.authToken);

  const updateConfig = useCallback((next: AppConfig) => {
    setConfig(next);
    saveConfig(next);
  }, []);

  const logout = useCallback(
    (reason?: string) => {
      updateConfig({ ...loadConfig(), authToken: '', authExpiresAt: '' });
      setSelectedIds(new Set());
      if (reason) toast.info(reason);
    },
    [toast, updateConfig],
  );

  /** Yazma işlemlerinde 401 gelirse oturumu kapat */
  const handleWriteError = useCallback(
    (error: unknown, prefix: string) => {
      if (error instanceof ApiRequestError && error.status === 401) {
        logout('Oturum süresi doldu, lütfen tekrar giriş yapın.');
        return;
      }
      toast.error(`${prefix}: ${errorMessage(error)}`);
    },
    [logout, toast],
  );

  // ------------------------------------------------------------ veriler
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadBooks = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setBooks(await db.listBooks());
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  // Kayıtlı oturum hâlâ geçerli mi?
  useEffect(() => {
    if (!tokenRef.current) return;
    db.checkSession()
      .then((ok) => {
        if (!ok) logout('Oturum süresi doldu.');
      })
      .catch(() => undefined);
    // yalnızca ilk açılışta
  }, []);

  // ------------------------------------------------------------ arama & filtre
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 200);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => readJsonStorage<SavedFilter[]>(PREF_KEYS.savedFilters, []));
  const [filtersOpen, setFiltersOpen] = useState(false);

  const visibleBooks = useMemo(() => applyFilters(books, filters, debouncedSearch), [books, filters, debouncedSearch]);
  const genres = useMemo(() => distinctValues(books, 'genre'), [books]);
  const filtering = !isFiltersEmpty(filters) || debouncedSearch.trim() !== '';

  const saveFilter = (name: string) => {
    const next = [...savedFilters.filter((saved) => saved.name !== name), { id: crypto.randomUUID(), name, filters }];
    setSavedFilters(next);
    writeJsonStorage(PREF_KEYS.savedFilters, next);
    toast.success(`“${name}” filtresi kaydedildi`);
  };
  const deleteFilter = (id: string) => {
    const next = savedFilters.filter((saved) => saved.id !== id);
    setSavedFilters(next);
    writeJsonStorage(PREF_KEYS.savedFilters, next);
  };
  const resetAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearch('');
  };

  // ------------------------------------------------------------ görünüm tercihleri
  const [viewMode, setViewMode] = useState<ViewMode>(() => (readJsonStorage<string>(PREF_KEYS.viewMode, 'grid') === 'list' ? 'list' : 'grid'));
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [shelfTheme, setShelfTheme] = useState<ShelfThemeId>(() => {
    const stored = readJsonStorage<string>(PREF_KEYS.shelfTheme, 'classic');
    return stored in SHELF_THEMES ? (stored as ShelfThemeId) : 'classic';
  });
  const [zoom, setZoom] = useState<number>(() => {
    const stored = readJsonStorage<number>(PREF_KEYS.gridZoom, 1);
    return typeof stored === 'number' && stored >= ZOOM_MIN && stored <= ZOOM_MAX ? stored : 1;
  });

  const changeView = (mode: ViewMode) => {
    setViewMode(mode);
    writeJsonStorage(PREF_KEYS.viewMode, mode);
  };
  const changeZoom = (delta: number) => {
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((zoom + delta) / ZOOM_STEP) * ZOOM_STEP));
    setZoom(next);
    writeJsonStorage(PREF_KEYS.gridZoom, next);
  };
  const changeShelfTheme = (theme: ShelfThemeId) => {
    setShelfTheme(theme);
    writeJsonStorage(PREF_KEYS.shelfTheme, theme);
  };

  // ------------------------------------------------------------ seçim & toplu işlem
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState<Set<number>>(new Set());

  // Var olmayan (silinmiş) kitapları seçimden düş
  useEffect(() => {
    setSelectedIds((current) => {
      const ids = new Set(books.map((book) => book.id));
      const next = new Set([...current].filter((id) => ids.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [books]);

  const toggleSelect = useCallback((book: Book) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(book.id)) next.delete(book.id);
      else next.add(book.id);
      return next;
    });
  }, []);

  const toggleSelectAll = (list: readonly Book[]) => {
    setSelectedIds((current) => {
      const all = list.every((book) => current.has(book.id));
      return all ? new Set() : new Set(list.map((book) => book.id));
    });
  };

  const bulkSetStatus = async (status: ReadingStatus) => {
    const ids = [...selectedIds];
    const previous = books;
    setBulkBusy(true);
    setBooks((current) => current.map((book) => (selectedIds.has(book.id) ? { ...book, status } : book)));
    try {
      await db.setStatus(ids, status);
      toast.success(`${ids.length} kitap “${status}” olarak işaretlendi`);
      setSelectedIds(new Set());
    } catch (error) {
      setBooks(previous);
      handleWriteError(error, 'Durum güncellenemedi');
    } finally {
      setBulkBusy(false);
    }
  };

  const cycleStatus = useCallback(
    async (book: Book) => {
      const status = nextStatus(book.status);
      setStatusBusy((current) => new Set(current).add(book.id));
      setBooks((current) => current.map((item) => (item.id === book.id ? { ...item, status } : item)));
      try {
        await db.setStatus([book.id], status);
      } catch (error) {
        setBooks((current) => current.map((item) => (item.id === book.id ? { ...item, status: book.status } : item)));
        handleWriteError(error, 'Durum güncellenemedi');
      } finally {
        setStatusBusy((current) => {
          const next = new Set(current);
          next.delete(book.id);
          return next;
        });
      }
    },
    [db, handleWriteError],
  );

  // ------------------------------------------------------------ modallar
  const [detailId, setDetailId] = useState<number | null>(null);
  const detailBook = detailId === null ? null : (books.find((book) => book.id === detailId) ?? null);
  const [editor, setEditor] = useState<{ open: boolean; book: Book | null }>({ open: false, book: null });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);

  const openDetail = useCallback((book: Book) => setDetailId(book.id), []);
  const openEditor = useCallback((book: Book | null) => {
    setDetailId(null);
    setEditor({ open: true, book });
  }, []);
  const askDelete = useCallback((book: Book) => setToDelete(book), []);

  const submitBook = async (input: BookInput, bookId: number | null) => {
    try {
      if (bookId === null) {
        const created = await db.createBook(input);
        setBooks((current) => [created, ...current]);
        toast.success(`“${created.title}” kitaplığa eklendi`);
      } else {
        const updated = await db.updateBook(bookId, input);
        setBooks((current) => current.map((book) => (book.id === bookId ? updated : book)));
        toast.success('Değişiklikler kaydedildi');
      }
      setEditor({ open: false, book: null });
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setEditor({ open: false, book: null });
        logout('Oturum süresi doldu, lütfen tekrar giriş yapın.');
        return;
      }
      throw error; // modal içinde gösterilir
    }
  };

  const saveBulkBook = async (input: BookInput) => {
    try {
      const created = await db.createBook(input);
      setBooks((current) => [created, ...current]);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setBulkOpen(false);
        logout('Oturum süresi doldu, lütfen tekrar giriş yapın.');
      }
      throw error;
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await db.deleteBook(toDelete.id);
      setBooks((current) => current.filter((book) => book.id !== toDelete.id));
      if (detailId === toDelete.id) setDetailId(null);
      toast.success(`“${toDelete.title}” silindi`);
      setToDelete(null);
    } catch (error) {
      handleWriteError(error, 'Silinemedi');
    } finally {
      setDeleting(false);
    }
  };

  const runBackup = async () => {
    if (books.length === 0) {
      toast.info('Yedeklenecek kitap yok');
      return;
    }
    setBackupBusy(true);
    try {
      const { photos, failed } = await backupPhotos(books, db.coverUrl);
      toast.success(`${photos} kapak fotoğrafı yedeklendi${failed ? ` (${failed} indirilemedi)` : ''}`);
    } catch (error) {
      toast.error(`Yedek oluşturulamadı: ${errorMessage(error)}`);
    } finally {
      setBackupBusy(false);
    }
  };

  const login = async (password: string) => {
    const session = await db.login(password);
    updateConfig({ ...config, authToken: session.token, authExpiresAt: session.expiresAt });
    toast.success('Giriş yapıldı — düzenleme modu açık');
    setSettingsOpen(false);
  };

  // ------------------------------------------------------------ render
  const sidebar = (
    <Sidebar books={books} filters={filters} onChange={setFilters} savedFilters={savedFilters} onSaveFilter={saveFilter} onDeleteFilter={deleteFilter} />
  );

  return (
    <div className="min-h-dvh">
      <Header
        search={search}
        onSearchChange={setSearch}
        canEdit={canEdit}
        backupBusy={backupBusy}
        onAdd={() => openEditor(null)}
        onBulkAdd={() => setBulkOpen(true)}
        onBackup={runBackup}
        onSettings={() => setSettingsOpen(true)}
      />

      <div className="mx-auto flex max-w-[1600px] gap-8 px-4 pb-28 pt-5 sm:px-6">
        <aside className="hidden w-[272px] shrink-0 lg:block">
          <div className="scrollbar-thin sticky top-[88px] max-h-[calc(100dvh-104px)] overflow-y-auto pb-6 pr-1">{sidebar}</div>
        </aside>

        <main className="min-w-0 flex-1">
          {/* Araç çubuğu */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-line bg-white p-0.5" role="tablist" aria-label="Görünüm">
              <ViewTab active={viewMode === 'grid'} onClick={() => changeView('grid')} icon={<LayoutGrid size={15} />} label="Grid" />
              <ViewTab active={false} onClick={() => setLibraryOpen(true)} icon={<Library size={15} />} label="Raf" />
              <ViewTab active={viewMode === 'list'} onClick={() => changeView('list')} icon={<List size={15} />} label="Liste" />
            </div>

            <button type="button" className="btn-secondary h-9 px-3 lg:hidden" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal size={15} />
              Filtreler
              {!isFiltersEmpty(filters) && <span className="h-1.5 w-1.5 rounded-full bg-reading" />}
            </button>

            <p className="ml-1 text-sm text-muted">
              {loading ? 'Yükleniyor…' : filtering ? `${visibleBooks.length} / ${books.length} kitap` : `${books.length} kitap`}
            </p>

            {viewMode === 'grid' && (
              <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-line bg-white p-0.5">
                <button type="button" className="icon-btn h-8 w-8" onClick={() => changeZoom(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} aria-label="Küçült" title="Küçült">
                  <ZoomOut size={16} />
                </button>
                <span className="w-11 text-center text-xs tabular-nums text-muted">{Math.round(zoom * 100)}%</span>
                <button type="button" className="icon-btn h-8 w-8" onClick={() => changeZoom(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} aria-label="Büyüt" title="Büyüt">
                  <ZoomIn size={16} />
                </button>
              </div>
            )}
          </div>

          {/* İçerik */}
          {loading ? (
            <GridSkeleton zoom={zoom} />
          ) : loadError ? (
            <EmptyState
              icon={<WifiOff size={28} />}
              title="Kitaplık yüklenemedi"
              text={loadError}
              action={
                <button type="button" className="btn-primary" onClick={() => void loadBooks()}>
                  <RefreshCw size={15} />
                  Tekrar Dene
                </button>
              }
            />
          ) : books.length === 0 ? (
            <EmptyState
              icon={<BookPlus size={28} />}
              title="Kitaplık henüz boş"
              text={canEdit ? 'İlk kitabınızı ekleyin — arka kapaktaki barkodun fotoğrafı yeterli.' : 'Burada henüz kitap yok. Yakında raflar dolacak.'}
              action={
                canEdit ? (
                  <button type="button" className="btn-primary" onClick={() => openEditor(null)}>
                    <BookPlus size={15} />
                    İlk Kitabı Ekle
                  </button>
                ) : undefined
              }
            />
          ) : visibleBooks.length === 0 ? (
            <EmptyState
              icon={<SearchX size={28} />}
              title="Eşleşen kitap yok"
              text="Arama veya filtreleri değiştirmeyi deneyin."
              action={
                <button type="button" className="btn-secondary" onClick={resetAll}>
                  Filtreleri Sıfırla
                </button>
              }
            />
          ) : viewMode === 'list' ? (
            <ListView books={visibleBooks} canEdit={canEdit} selectedIds={selectedIds} onToggleSelect={toggleSelect} onToggleSelectAll={toggleSelectAll} onOpen={openDetail} />
          ) : (
            <div className="grid gap-x-5 gap-y-7" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round(150 * zoom)}px, 1fr))` }}>
              {visibleBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  coverSrc={db.coverUrl(book)}
                  canEdit={canEdit}
                  selected={selectedIds.has(book.id)}
                  statusBusy={statusBusy.has(book.id)}
                  onOpen={openDetail}
                  onEdit={openEditor}
                  onDelete={askDelete}
                  onToggleSelect={toggleSelect}
                  onCycleStatus={cycleStatus}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Mobil filtre paneli */}
      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtreler" subtitle={`${visibleBooks.length} kitap gösteriliyor`}>
        <div className="px-5 py-5">{sidebar}</div>
      </Modal>

      <LibraryView open={libraryOpen} books={visibleBooks} theme={shelfTheme} onThemeChange={changeShelfTheme} onClose={() => setLibraryOpen(false)} onOpenBook={openDetail} />

      <BookDetailModal
        book={detailBook}
        coverSrc={detailBook ? db.coverUrl(detailBook) : ''}
        canEdit={canEdit}
        onClose={() => setDetailId(null)}
        onEdit={openEditor}
        onDelete={askDelete}
        onCycleStatus={cycleStatus}
      />

      {canEdit && (
        <>
          <UploadModal
            open={editor.open}
            book={editor.book}
            existingCoverSrc={editor.book ? db.coverUrl(editor.book) : ''}
            genres={genres}
            library={books}
            remote={db.lookup}
            onClose={() => setEditor({ open: false, book: null })}
            onSubmit={submitBook}
          />
          <BulkUploadModal open={bulkOpen} library={books} remote={db.lookup} onClose={() => setBulkOpen(false)} onSave={saveBulkBook} />
          <BulkBar count={selectedIds.size} busy={bulkBusy} onSetStatus={(status) => void bulkSetStatus(status)} onClear={() => setSelectedIds(new Set())} />
        </>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Kitabı sil"
        message={
          <>
            <strong className="font-serif text-ink">“{toDelete?.title}”</strong> kitaplıktan kalıcı olarak silinecek. Bu işlem geri alınamaz.
          </>
        }
        confirmLabel="Sil"
        danger
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />

      <SettingsModal open={settingsOpen} config={config} canEdit={canEdit} onClose={() => setSettingsOpen(false)} onSave={updateConfig} onLogin={login} onLogout={() => logout('Çıkış yapıldı')} />
    </div>
  );
}

function ViewTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition ${active ? 'bg-ink text-paper' : 'text-muted hover:text-ink'}`}
    >
      {icon}
      {label}
    </button>
  );
}

function GridSkeleton({ zoom }: { zoom: number }) {
  return (
    <div className="grid gap-x-5 gap-y-7" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round(150 * zoom)}px, 1fr))` }} aria-busy="true">
      {Array.from({ length: 12 }, (_, index) => (
        <div key={index}>
          <div className="skeleton aspect-[3/4] w-full" />
          <div className="skeleton mt-3 h-4 w-4/5" />
          <div className="skeleton mt-1.5 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white/60 px-6 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-soft text-accent">{icon}</div>
      <h2 className="font-serif text-2xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
