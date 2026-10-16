import type { CapacitorConfig } from '@capacitor/cli';

// Kitaplığım mobil uygulaması — aynı React kodu, API gelengitech.com/bookstore/api (bkz. .env.mobile)
const config: CapacitorConfig = {
  appId: 'com.gelengitech.kitapligim',
  appName: 'Kitaplığım',
  webDir: 'dist-mobile',
  ios: {
    // Arka plan uygulama renginde; içerik güvenli alanları CSS ile yönetir (env(safe-area-inset-*))
    backgroundColor: '#fdfcfb',
    contentInset: 'never',
  },
};

export default config;
