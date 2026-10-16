// Tarayıcı tarafı ayarlar ve tercihler (localStorage).
// Her okuma/yazma try/catch içinde: gizli pencerede veya engellenmiş depolamada uygulama yine çalışır.

export interface AppConfig {
  /** Sahip oturum anahtarı (API'den alınır) */
  authToken: string;
  authExpiresAt: string;
  /** API kök adresi — web'de varsayılan aynı alan adı; mobil/harici kullanım için değiştirilebilir */
  apiBase: string;
}

// Web: aynı alan adı (/bookstore/api). Mobil derlemede (vite --mode mobile) VITE_API_BASE ile tam adres verilir.
export const DEFAULT_API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || `${import.meta.env.BASE_URL}api`;

const CONFIG_KEY = 'kitapligim.config.v1';

const DEFAULT_CONFIG: AppConfig = {
  authToken: '',
  authExpiresAt: '',
  apiBase: DEFAULT_API_BASE,
};

export function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonStorage(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // depolama kullanılamıyor — sessizce yoksay
  }
}

export function loadConfig(): AppConfig {
  const stored = readJsonStorage<Partial<AppConfig>>(CONFIG_KEY, {});
  const config: AppConfig = {
    authToken: stored.authToken ?? DEFAULT_CONFIG.authToken,
    authExpiresAt: stored.authExpiresAt ?? DEFAULT_CONFIG.authExpiresAt,
    apiBase: stored.apiBase ?? DEFAULT_CONFIG.apiBase,
  };
  if (!config.apiBase) config.apiBase = DEFAULT_API_BASE;
  if (config.authExpiresAt && Date.parse(config.authExpiresAt) <= Date.now()) {
    config.authToken = '';
    config.authExpiresAt = '';
  }
  return config;
}

export function saveConfig(config: AppConfig): void {
  writeJsonStorage(CONFIG_KEY, config);
}

/** Uygulama içi tercih anahtarları */
export const PREF_KEYS = {
  gridZoom: 'kitapligim.gridZoom',
  viewMode: 'kitapligim.viewMode',
  shelfTheme: 'kitapligim.shelfTheme',
  savedFilters: 'kitapligim.savedFilters',
} as const;
