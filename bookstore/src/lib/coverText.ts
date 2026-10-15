// Kapak fotoğrafından okunan kelimelerden (OCR) yazar / yayınevi / başlık tahmini.
// Saf fonksiyonlar: tarayıcıya, ağa veya tesseract'a bağımlı değildir — test edilebilir ve mobilde de kullanılabilir.

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface LibraryHints {
  authors: readonly string[];
  publishers: readonly string[];
}

export interface CoverGuess {
  /** Kapakta okunan, temizlenmiş tüm kelimeler (katlanmış biçimde, eşleştirme için) */
  tokens: string[];
  author: string | null;
  publisher: string | null;
  /** Büyük puntolu kalan kelimelerden başlık tahmini */
  title: string;
  /** Çevrimiçi aramada kullanılacak kelimeler (büyük puntolu kelimeler + yazar soyadı) */
  query: string;
  /** Daha dar yedek sorgu */
  narrowQuery: string;
}

// ------------------------------------------------------------------ Metin yardımcıları

/** Türkçe harfleri ASCII'ye katlar, küçük harfe çevirir, harf/rakam dışını atar */
export function fold(value: string): string {
  return value
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function tokenize(value: string): string[] {
  return value
    .replace(/['’`]/g, '') // "Roma'nın" → "romanin" (OCR iki parça okursa bitişik eşleşme yakalar)
    .split(/[\s".,:;!?()\-–—/]+/)
    .map(fold)
    .filter((token) => token.length > 0);
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j] ?? 0;
      row[j] = Math.min((row[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = temp;
    }
  }
  return row[b.length] ?? Math.max(a.length, b.length);
}

/** OCR hatalarına toleranslı kelime eşleşmesi */
function similar(expected: string, seen: string): boolean {
  if (expected === seen) return true;
  if (expected.length < 4 || seen.length < 3) return false;
  // "roma" ↔ "romani" gibi ek almış/yarım okunmuş kelimeler
  if (seen.length >= expected.length && seen.startsWith(expected)) return true;
  const allowed = expected.length >= 7 ? 2 : 1;
  return editDistance(expected, seen) <= allowed;
}

/** Beklenen kelime OCR kelimelerinde (veya bitişik iki kelimenin birleşiminde) geçiyor mu? */
export function tokenSeen(expected: string, tokens: readonly string[]): boolean {
  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i] ?? '';
    if (similar(expected, current)) return true;
    const next = tokens[i + 1];
    if (next && similar(expected, current + next)) return true;
  }
  return false;
}

/** Bir metnin kelimelerinin ne kadarı kapakta görülmüş (0–1) */
export function coverage(text: string, tokens: readonly string[]): number {
  const words = tokenize(text).filter((word) => word.length >= 2);
  if (words.length === 0) return 0;
  const hits = words.filter((word) => tokenSeen(word, tokens)).length;
  return hits / words.length;
}

// ------------------------------------------------------------------ OCR kelimelerini birleştir

function overlap(a: OcrWord['bbox'], b: OcrWord['bbox']): number {
  const width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (width <= 0 || height <= 0) return 0;
  const intersection = width * height;
  const smaller = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
  return smaller > 0 ? intersection / smaller : 0;
}

/** Farklı ön işlemelerden gelen kelimeleri birleştirir; çakışanlardan en güvenilirini tutar */
export function mergeWords(passes: readonly (readonly OcrWord[])[], minConfidence = 55): OcrWord[] {
  const candidates = passes
    .flat()
    .map((word) => ({ ...word, text: word.text.trim() }))
    .filter((word) => word.confidence >= minConfidence && /\p{L}{2,}/u.test(word.text))
    .sort((a, b) => b.confidence - a.confidence);
  const kept: OcrWord[] = [];
  for (const word of candidates) {
    if (kept.some((other) => overlap(other.bbox, word.bbox) > 0.5)) continue;
    kept.push(word);
  }
  // okuma sırası: satır satır, soldan sağa
  return kept.sort((a, b) => {
    const rowA = (a.bbox.y0 + a.bbox.y1) / 2;
    const rowB = (b.bbox.y0 + b.bbox.y1) / 2;
    const tolerance = Math.min(a.bbox.y1 - a.bbox.y0, b.bbox.y1 - b.bbox.y0) / 2;
    return Math.abs(rowA - rowB) > tolerance ? rowA - rowB : a.bbox.x0 - b.bbox.x0;
  });
}

// ------------------------------------------------------------------ Tahmin

/** Kapaklarda sık geçen ama başlığa ait olmayan kelimeler */
const NOISE = new Set(
  [
    'yayinlari', 'yayinevi', 'yayincilik', 'yayin', 'kitap', 'kitabi', 'kitaplari', 'roman', 'oyku', 'oykuler', 'siir', 'deneme',
    'inceleme', 'arastirma', 'ceviri', 'ceviren', 'cev', 'odulu', 'odul', 'nobel', 'ekonomi', 'edebiyat', 'baski', 'basim',
    'satan', 'cok', 'milyon', 'kopya', 'dizisi', 'serisi', 'bir', 'yazari', 'yazarindan', 'new', 'york', 'times', 'bestseller',
    'klasikleri', 'modern', 'dunya', 'turk', 'the', 'and', 'tam', 'metin', 'kisaltilmamis',
  ].map(fold),
);

/** Yayınevi kısaltmaları ve logolarda geçen kısa adlar */
const PUBLISHER_ALIASES: Record<string, string> = {
  yky: 'Yapı Kredi Yayınları',
  dk: 'Doğan Kitap',
  iletisim: 'İletişim Yayınları',
  can: 'Can Yayınları',
  ithaki: 'İthaki Yayınları',
  everest: 'Everest Yayınları',
  pegasus: 'Pegasus Yayınları',
  alfa: 'Alfa Yayınları',
  dogan: 'Doğan Kitap',
  timas: 'Timaş Yayınları',
  kronik: 'Kronik Kitap',
  metis: 'Metis Yayınları',
  sel: 'Sel Yayıncılık',
  domingo: 'Domingo Yayınevi',
  epsilon: 'Epsilon Yayınevi',
  altin: 'Altın Kitaplar',
  remzi: 'Remzi Kitabevi',
  turkiye: 'Türkiye İş Bankası Kültür Yayınları',
  isbankasi: 'Türkiye İş Bankası Kültür Yayınları',
  everestyayinlari: 'Everest Yayınları',
};

/** "Daron Acemoğlu, James A. Robinson" gibi çok yazarlı kayıtları tek tek adlara ayırır */
function splitAuthors(authors: readonly string[]): string[] {
  const names = new Set<string>();
  for (const entry of authors) {
    if (entry.trim()) names.add(entry.trim());
    for (const part of entry.split(/\s*(?:,|&|;|\bve\b|\band\b)\s*/)) if (part.trim()) names.add(part.trim());
  }
  return [...names];
}

function bestAuthor(tokens: readonly string[], authors: readonly string[]): { name: string; words: string[] } | null {
  let best: { name: string; words: string[]; score: number } | null = null;
  for (const name of splitAuthors(authors)) {
    const words = tokenize(name).filter((word) => word.length >= 2);
    if (words.length === 0) continue;
    const surname = words[words.length - 1] ?? '';
    if (surname.length < 3 || !tokenSeen(surname, tokens)) continue;
    const hits = words.filter((word) => tokenSeen(word, tokens)).length;
    // tek kelimelik eşleşme ancak soyadı uzun ve birebir okunmuşsa yeterli (yanlış pozitifleri önler)
    if (hits < 2 && !(words.length === 1 || (surname.length >= 5 && tokens.includes(surname)))) continue;
    const score = hits / words.length + hits * 0.01;
    if (!best || score > best.score) best = { name, words, score };
  }
  return best && best.score >= 0.5 ? { name: best.name, words: best.words } : null;
}

function bestPublisher(tokens: readonly string[], publishers: readonly string[]): { name: string; words: string[] } | null {
  // 1) kütüphanedeki yayınevleri — ayırt edici ilk kelime kapakta geçmeli
  let best: { name: string; words: string[]; score: number } | null = null;
  for (const name of publishers) {
    const words = tokenize(name).filter((word) => word.length >= 3 && !NOISE.has(word));
    if (words.length === 0) continue;
    const hits = words.filter((word) => tokenSeen(word, tokens)).length;
    if (hits === 0 || !tokenSeen(words[0] ?? '', tokens)) continue;
    const score = hits / words.length;
    if (!best || score > best.score) best = { name, words, score };
  }
  if (best && best.score >= 0.5) return { name: best.name, words: best.words };
  // 2) bilinen kısaltmalar (YKY, DK …) — logo parçalı okunabilir ("YK" + "KY"), bitişik ikilileri de dene
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? '';
    const next = tokens[i + 1] ?? '';
    const variants = [token, token + next, next ? token + next.slice(-1) : ''];
    for (const variant of variants) {
      const alias = variant ? PUBLISHER_ALIASES[variant] : undefined;
      if (alias) return { name: publishers.find((name) => fold(name) === fold(alias)) ?? alias, words: [token, next].filter(Boolean) };
    }
  }
  return null;
}

/** OCR çöplerini ele: kısa/sessiz harfli parçalar ancak çok yüksek güvenle kabul edilir */
function isPlausibleWord(word: OcrWord): boolean {
  const letters = word.text.replace(/[^\p{L}]/gu, '');
  if (letters.length < 2) return false;
  if (!/[aeıioöuüâîûAEIİOÖUÜÂÎÛ]/u.test(letters)) return false;
  if (letters.length <= 3) return word.confidence >= 85;
  return word.confidence >= 65;
}

function titleCase(value: string): string {
  return value
    .toLocaleLowerCase('tr')
    .split(' ')
    .map((word) => (word ? word.charAt(0).toLocaleUpperCase('tr') + word.slice(1) : word))
    .join(' ');
}

export function guessFromCover(words: readonly OcrWord[], hints: LibraryHints): CoverGuess {
  const tokens = words.flatMap((word) => tokenize(word.text));
  const author = bestAuthor(tokens, hints.authors);
  const publisher = bestPublisher(tokens, hints.publishers);

  const used = new Set([...(author?.words ?? []), ...(publisher?.words ?? [])]);
  const candidates = words.filter((word) => {
    const folded = tokenize(word.text);
    if (folded.length === 0) return false;
    return (
      isPlausibleWord(word) &&
      folded.every((token) => !NOISE.has(token) && !(author && author.words.some((w) => similar(w, token))) && !used.has(token))
    );
  });

  // başlık genelde en büyük puntolu yazıdır; en büyüğün yarısından küçükleri ele
  const heightOf = (word: OcrWord) => word.bbox.y1 - word.bbox.y0;
  const tallest = Math.max(0, ...candidates.map(heightOf));
  const titleWords = candidates.filter((word) => heightOf(word) >= tallest * 0.45).map((word) => word.text.replace(/[^\p{L}\p{N}'’\- ]/gu, ''));
  const title = titleCase(titleWords.join(' ').replace(/\s+/g, ' ').trim());

  // arama sorgusu: en büyük puntolu anlamlı kelimeler (+ bulunduysa yazar soyadı)
  const salient = [...candidates].sort((a, b) => heightOf(b) - heightOf(a)).slice(0, 6).sort((a, b) => words.indexOf(a) - words.indexOf(b));
  const surname = author ? (tokenize(author.name).pop() ?? '') : '';
  const query = [...salient.map((word) => word.text.replace(/[^\p{L}\p{N}'’ ]/gu, '')), surname].filter(Boolean).join(' ').trim();
  // daha dar yedek sorgu: en uzun iki başlık kelimesi + soyadı (gürültülü kelimeler aramayı boşa düşürmesin)
  const longest = [...titleWords].sort((a, b) => b.length - a.length).slice(0, 2).join(' ');
  const narrowQuery = [longest, surname].filter(Boolean).join(' ').trim();
  return { tokens, author: author?.name ?? null, publisher: publisher?.name ?? null, title, query, narrowQuery };
}

/** Çevrimiçi bir adayın kapakla ne kadar uyuştuğu (0–1). Başlık ağırlıklı, yazar destekleyici. */
export function scoreCandidate(candidate: { title: string; author: string }, guess: CoverGuess): number {
  const mainTitle = candidate.title.split(':')[0] ?? candidate.title;
  const titleScore = coverage(mainTitle, guess.tokens);
  const authorWords = tokenize(candidate.author);
  const surname = authorWords[authorWords.length - 1];
  let authorScore = surname && tokenSeen(surname, guess.tokens) ? 1 : 0;
  if (guess.author && surname && tokenize(guess.author).includes(surname)) authorScore = 1;
  return titleScore * 0.75 + authorScore * 0.25;
}
