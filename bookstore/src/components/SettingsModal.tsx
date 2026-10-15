// Ayarlar — sahip girişi, kitap tanıma seçenekleri, API adresi

import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, LogOut, ScanText, ServerCog, ShieldCheck } from 'lucide-react';
import type { AppConfig } from '../services/config';
import { DEFAULT_API_BASE } from '../services/config';
import { Modal, Spinner, errorMessage } from './ui';

interface SettingsModalProps {
  open: boolean;
  config: AppConfig;
  canEdit: boolean;
  onClose: () => void;
  onSave: (config: AppConfig) => void;
  onLogin: (password: string) => Promise<void>;
  onLogout: () => void;
}

export function SettingsModal({ open, config, canEdit, onClose, onSave, onLogin, onLogout }: SettingsModalProps) {
  const [draft, setDraft] = useState(config);
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (open) {
      setDraft(config);
      setPassword('');
      setLoginError('');
    }
  }, [open, config]);

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) return;
    setLoginBusy(true);
    setLoginError('');
    try {
      await onLogin(password);
      setPassword('');
    } catch (error) {
      setLoginError(errorMessage(error));
    } finally {
      setLoginBusy(false);
    }
  };

  const expires = config.authExpiresAt ? new Date(config.authExpiresAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ayarlar"
      subtitle="Sahip girişi ve kitap tanıma seçenekleri"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              onSave({ ...draft, apiBase: draft.apiBase.trim() || DEFAULT_API_BASE, googleBooksApiKey: draft.googleBooksApiKey.trim() });
              onClose();
            }}
          >
            Kaydet
          </button>
        </>
      }
    >
      <div className="space-y-6 px-5 py-5 sm:px-6">
        {/* Sahip girişi */}
        <section className="rounded-xl border border-line bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            {canEdit ? <ShieldCheck size={18} className="text-read" /> : <KeyRound size={18} className="text-accent" />}
            <h3 className="font-serif text-base font-semibold">Sahip Girişi</h3>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Düzenleme modundasınız{expires ? ` · oturum ${expires} tarihine kadar geçerli` : ''}.
              </p>
              <button type="button" className="btn-secondary" onClick={onLogout}>
                <LogOut size={15} />
                Çıkış Yap
              </button>
            </div>
          ) : (
            <form onSubmit={submitLogin} className="space-y-2">
              <p className="text-sm text-muted">Ziyaretçiler kitaplığı yalnızca görüntüler. Kitap eklemek ve düzenlemek için şifrenizi girin.</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  className="field"
                  placeholder="Şifre"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button type="submit" className="btn-primary shrink-0" disabled={loginBusy || !password}>
                  {loginBusy && <Spinner size={14} />}
                  Giriş
                </button>
              </div>
              {loginError && <p className="text-sm text-danger">{loginError}</p>}
            </form>
          )}
        </section>

        {/* Kitap tanıma */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ScanText size={18} className="text-accent" />
            <h3 className="font-serif text-base font-semibold">Kitap Tanıma</h3>
          </div>
          <p className="-mt-2 text-sm text-muted">
            Fotoğraftaki barkoddan ISBN okunur; bilgiler Google Books ve Open Library’den getirilir. Yapay zekâ servisi kullanılmaz.
          </p>
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line bg-white p-3.5">
            <span>
              <span className="block text-sm font-medium">Künye sayfasında metin tanıma (OCR)</span>
              <span className="mt-0.5 block text-xs text-muted">Barkod bulunamazsa ISBN’i künye sayfasından okur. İlk kullanımda ~15 MB dil verisi indirilir.</span>
            </span>
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0 accent-[#1a1a1a]"
              checked={draft.ocrEnabled}
              onChange={(event) => setDraft({ ...draft, ocrEnabled: event.target.checked })}
            />
          </label>
          <label className="block">
            <span className="label">Google Books API Anahtarı (isteğe bağlı)</span>
            <input
              className="field font-mono text-xs"
              placeholder="AIza…"
              value={draft.googleBooksApiKey}
              onChange={(event) => setDraft({ ...draft, googleBooksApiKey: event.target.value })}
              autoComplete="off"
              spellCheck={false}
            />
            <span className="mt-1 block text-xs text-muted">Anahtarsız da çalışır; çok sayıda toplu eklemede kota aşımını önler.</span>
          </label>
        </section>

        {/* Gelişmiş */}
        <details className="group rounded-xl border border-line bg-white p-3.5">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
            <ServerCog size={16} className="text-accent" />
            Gelişmiş: API adresi
          </summary>
          <div className="mt-3 space-y-1.5">
            <input
              className="field font-mono text-xs"
              value={draft.apiBase}
              onChange={(event) => setDraft({ ...draft, apiBase: event.target.value })}
              spellCheck={false}
            />
            <p className="text-xs text-muted">Varsayılan: {DEFAULT_API_BASE}. Mobil uygulama da aynı API’yi (https://gelengitech.com/bookstore/api) kullanır.</p>
          </div>
        </details>
      </div>
    </Modal>
  );
}
