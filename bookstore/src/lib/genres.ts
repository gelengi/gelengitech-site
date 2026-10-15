// Türkçe tür listesi ve çevrimiçi kaynaklardaki (çoğunlukla İngilizce) kategorilerin eşlemesi

export const DEFAULT_GENRES = [
  'Roman',
  'Öykü',
  'Şiir',
  'Deneme',
  'Tarih',
  'Felsefe',
  'Bilim',
  'Biyografi',
  'Anı',
  'Psikoloji',
  'Sosyoloji',
  'Ekonomi',
  'Siyaset',
  'Din',
  'Sanat',
  'Çocuk',
  'Gençlik',
  'Fantastik',
  'Bilimkurgu',
  'Polisiye',
  'Kişisel Gelişim',
  'İş Dünyası',
  'Teknoloji',
  'Eğitim',
  'Gezi',
  'Yemek',
  'Sağlık',
  'Diğer',
] as const;

const RULES: ReadonlyArray<[RegExp, string]> = [
  [/science fiction|bilim ?kurgu/i, 'Bilimkurgu'],
  [/fantasy|fantastik/i, 'Fantastik'],
  [/detective|mystery|crime|thriller|polisiye/i, 'Polisiye'],
  [/juvenile fiction|young adult|gençlik/i, 'Gençlik'],
  [/juvenile|children|çocuk/i, 'Çocuk'],
  [/poetry|şiir/i, 'Şiir'],
  [/short stor|öykü|hikaye|hikâye/i, 'Öykü'],
  [/biography|autobiography|biyografi/i, 'Biyografi'],
  [/memoir|^anı|anılar/i, 'Anı'],
  [/essay|deneme/i, 'Deneme'],
  [/fiction|novel|roman|literature|edebiyat/i, 'Roman'],
  [/history|tarih/i, 'Tarih'],
  [/philosophy|felsefe/i, 'Felsefe'],
  [/psychology|psikoloji/i, 'Psikoloji'],
  [/social science|sociology|sosyoloji/i, 'Sosyoloji'],
  [/political|politics|siyaset/i, 'Siyaset'],
  [/business|management|iş dünyası/i, 'İş Dünyası'],
  [/economics|ekonomi/i, 'Ekonomi'],
  [/self-help|personal development|kişisel gelişim/i, 'Kişisel Gelişim'],
  [/religion|islam|christian|\bdin\b/i, 'Din'],
  [/computers|technology|engineering|teknoloji|bilgisayar/i, 'Teknoloji'],
  [/science|mathematics|physics|biology|bilim/i, 'Bilim'],
  [/\barts?\b|music|architecture|photography|sanat/i, 'Sanat'],
  [/education|eğitim/i, 'Eğitim'],
  [/travel|gezi/i, 'Gezi'],
  [/cooking|yemek/i, 'Yemek'],
  [/health|medical|sağlık/i, 'Sağlık'],
];

/** Kaynak kategorilerini Türkçe türe çevirir; eşleşme yoksa '' döner (kullanıcı seçer) */
export function mapGenre(categories: readonly string[]): string {
  for (const category of categories) {
    for (const [pattern, genre] of RULES) {
      if (pattern.test(category)) return genre;
    }
  }
  return '';
}
