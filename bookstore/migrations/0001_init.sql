-- Kitaplığım — D1 (SQLite) şeması
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  publisher TEXT NOT NULL DEFAULT '',
  page_count INTEGER NOT NULL DEFAULT 0,
  genre TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Okunmadı' CHECK (status IN ('Okunmadı', 'Okunuyor', 'Okundu')),
  notes TEXT NOT NULL DEFAULT '',
  publication_year INTEGER,
  isbn TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_books_author_title ON books (author, title);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books (isbn);

-- Kapak görselleri ayrı tabloda tutulur; liste sorguları hafif kalır
CREATE TABLE IF NOT EXISTS covers (
  book_id INTEGER PRIMARY KEY REFERENCES books (id) ON DELETE CASCADE,
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  updated_at TEXT NOT NULL
);
