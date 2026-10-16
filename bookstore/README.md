# Kitaplığım — gelengitech.com/bookstore

Kişisel kütüphane kataloğu. Ön kapak fotoğrafından kitap bilgilerini otomatik çıkarır (yapay zekâ servisi olmadan). Grid, 3B ahşap raf (4 tema) ve Excel'e aktarılabilen özet liste görünümleri vardır. Ziyaretçiler kitaplığı görüntüler; ekleme ve düzenleme yalnızca sahip girişiyle yapılır.

## Mimari

```
gelengitech.com (Cloudflare Worker, wrangler.jsonc)
├── /                     Astro statik site (değişmedi)
├── /bookstore/           React 19 + Vite + Tailwind v4 SPA  → dist/bookstore
└── /bookstore/api/*      Worker API (bookstore/worker/index.ts) → Cloudflare D1 (SQLite)
```

- **Veritabanı:** Cloudflare D1 (`gelengi-bookstore`). Kitaplar `books` tablosunda, kapak görselleri `covers` tablosunda (BLOB) tutulur. Ek hizmet veya ücretli plan gerekmez; D1 ücretsiz katmanı kişisel kütüphane için fazlasıyla yeterli.
- **Kitap tanıma (yapay zekâ yok):**
  1. Ön kapakta OCR (tesseract.js, Türkçe+İngilizce, seyrek metin modu, gri + eşiklenmiş iki geçiş)
  2. Yazar/yayınevi önce kitaplıktaki adlarla eşleştirilir; kalan büyük puntolu kelimeler başlık tahmini olur (`src/lib/coverText.ts`)
  3. Tahminle Google Books (Worker vekili `/api/lookup`, anahtar sunucuda) ve Open Library'de aranır; kapakla en iyi uyuşan sonuç seçilir, yoksa tahmin forma yazılır
  4. Başlık/yazar ile çevrimiçi arama ve elle düzenleme her zaman mümkün
- **Yetki:** Okuma uçları herkese açık. Yazma uçları `Authorization: Bearer <token>` ister. Token, `ADMIN_PASSWORD` ile giriş yapınca 30 gün geçerli HMAC imzalı olarak verilir.
- **Görseller:** İstemcide en fazla 800×1200 px ve JPEG 0.7 kalitesine sıkıştırılır (~100–250 KB).

## İlk kurulum (tek seferlik, Cloudflare)

Repo kökünde (`gelengitech-site/`) çalıştırın:

```bash
npm install
npx wrangler login

# 1) D1 veritabanını oluştur → çıktıdaki database_id'yi wrangler.jsonc içine yaz
npx wrangler d1 create gelengi-bookstore

# 2) Tabloları oluştur
npx wrangler d1 migrations apply gelengi-bookstore --remote

# 3) Sahip şifresi ve oturum imza anahtarı (secret olarak, repoya girmez)
npx wrangler secret put ADMIN_PASSWORD
openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET

# 4) Yayınla (Cloudflare Git entegrasyonu açıksa main'e merge yeterli)
npm run deploy
```

> ⚠️ `database_id` gerçek değerle değiştirilmeden `main`'e merge edilirse deploy başarısız olur, ancak mevcut site yayında kalır.

Cloudflare panelindeki derleme ayarları: **Build command** `npm run build`, **Deploy command** `npx wrangler deploy`. Kök `build` betiği artık Astro'dan sonra bookstore'u da derliyor.

## Yerel geliştirme

```bash
# Repo kökünde, bir kez:
printf 'ADMIN_PASSWORD=test\nSESSION_SECRET=yerel-gizli-anahtar\n' > .dev.vars
npx wrangler d1 migrations apply gelengi-bookstore --local

# Terminal 1 — API + yerel D1 (SQLite, internet gerektirmez)
cd bookstore && npm run dev:api

# Terminal 2 — arayüz (http://localhost:5173/bookstore/)
cd bookstore && npm run dev
```

`npm run build` (bookstore içinde) önce üç TypeScript projesinin (app, worker, vite config) tip kontrolünü yapar, sonra `../dist/bookstore`'a derler.

## API (mobil uygulama için de aynı sözleşme)

Kök: `https://gelengitech.com/bookstore/api`. Tipler `src/types.ts` içinde. CORS açık, cookie kullanılmaz.

| Yöntem | Yol | Yetki | Açıklama |
|---|---|---|---|
| GET | `/health` | – | Sağlık kontrolü |
| POST | `/auth/login` `{password}` | – | `{token, expiresAt}` döner |
| GET | `/auth/me` | (token) | `{authenticated}` |
| GET | `/lookup?q=…` | ✓ | Google Books araması (vekil; `GOOGLE_BOOKS_API_KEY` sunucuda). `{items: volumeInfo[]}` |
| GET | `/books` | – | Tüm kitaplar (`Book[]`) |
| GET | `/books/:id` | – | Tek kitap |
| GET | `/books/:id/cover?v=…` | – | Kapak görseli (uzun süreli önbellek) |
| POST | `/books` `BookInput` | ✓ | Kitap ekle. `image`: data URL, `coverUrl`: Google Books/Open Library kapağı |
| PUT | `/books/:id` `Partial<BookInput>` | ✓ | Kısmi güncelleme. `image: null` kapağı kaldırır |
| PATCH | `/books/status` `{ids, status}` | ✓ | Toplu durum güncelleme |
| DELETE | `/books/:id` | ✓ | Sil |

Kitap alanlarına sonradan eklenenler: `purchaseDate` (YYYY-AA-GG, alış tarihi), `purchasePlace` (nereden alındı), `readingNote` (okuduktan sonra not). Bu kolonları Worker ilk istekte eksikse kendisi ekler (`ensureSchema`); D1 için ayrıca migration çalıştırmak gerekmez.

## Dosya yapısı

```
bookstore/
├── worker/index.ts          Cloudflare Worker: REST API + statik dosyalara geçiş
├── migrations/0001_init.sql D1 şeması
├── src/
│   ├── types.ts             Book, BookDetails, BookInput (web + worker + mobil)
│   ├── App.tsx              Sayfa düzeni, filtre motoru bağlantısı, toplu işlemler
│   ├── services/
│   │   ├── config.ts        localStorage ayarları (oturum, API adresi)
│   │   ├── db.ts            API istemcisi
│   │   ├── bookLookup.ts    Kapak OCR → eşleştirme → Google Books/Open Library
│   │   └── image.ts         Canvas sıkıştırma
│   ├── lib/                 filtreler, tür eşlemesi, Excel/ZIP dışa aktarma
│   └── components/          Header, Sidebar, BookCard, LibraryView, ListView,
│                            UploadModal, BulkUploadModal, SettingsModal, BookDetailModal, BulkBar
└── public/manifest.webmanifest  Ana ekrana eklenebilir (PWA temeli)
```

## Notlar

- **Google Books anahtarı:** Anahtarsız ortak kota sürekli dolu olduğundan Worker'a `GOOGLE_BOOKS_API_KEY` secret'ı tanımlayın (Google Cloud → Books API → API key; günde 1000 sorgu ücretsiz). Tanımlı değilse yalnızca Open Library + kapak tahmini kullanılır.
- **Türkçe yayınlar:** Google Books ve Open Library kapsamı her kitapta tam değildir. Özellikle **tür** alanı boş gelebilir, kaydetmeden önce kontrol edin.
- **OCR:** İlk kullanımda tarayıcı ~15 MB dil verisini (jsDelivr CDN) indirir. Stilize/el yazısı kapaklarda başlık eksik okunabilir; kaydetmeden önce kontrol edin.
- **Yedek:** "Fotoğrafları Yedekle" tüm kapakları ve `books.json` dosyasını `bookstore_photos_TARIH.zip` olarak indirir.
- **Mobil:** Arayüz responsive ve PWA manifesti var. Yerel mobil uygulama aynı API'yi kullanabilir.
- **Pages mi Workers mı?** API, `wrangler.jsonc` içindeki Worker (`main`) üzerinden çalışır. Bu, `npm run deploy` (wrangler deploy) veya Cloudflare **Workers Builds** ile yayında geçerlidir. Site bir **Pages** projesi olarak bağlıysa Worker kodu çalışmaz; API'nin `functions/` klasörüne taşınması gerekir.

## Mobil uygulama (iOS, Capacitor)

Aynı React kodu Capacitor ile iOS uygulamasına paketlenir; uygulama `https://gelengitech.com/bookstore/api` adresini kullanır (`.env.mobile`).

- Paket kimliği: `com.gelengitech.kitapligim`, ad: Kitaplığım (`capacitor.config.ts`)
- Xcode projesi: `ios/App` (Swift Package Manager; CocoaPods gerekmez)
- İkon ve açılış ekranı kaynakları: `assets/` → `npx @capacitor/assets generate --ios`
- Mac'te: `npm install` ardından `npm run ios` (mobil derleme + `cap sync ios` + Xcode'u açar). Web kodu değişince `npm run ios:sync` ve Xcode'da ▶.
