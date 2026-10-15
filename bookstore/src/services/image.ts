// İstemci taraflı görsel sıkıştırma (Canvas) — en fazla 800x1200 px, JPEG kalite 0.7

export const MAX_WIDTH = 800;
export const MAX_HEIGHT = 1200;
export const JPEG_QUALITY = 0.7;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Görsel okunamadı'));
    img.src = src;
  });
}

export function fitSize(width: number, height: number, maxW: number, maxH: number): { width: number; height: number } {
  const ratio = Math.min(1, maxW / width, maxH / height);
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/** Dosyayı sıkıştırılmış JPEG data URL'ine çevirir */
export async function compressImage(file: Blob, maxW = MAX_WIDTH, maxH = MAX_HEIGHT, quality = JPEG_QUALITY): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const { width, height } = fitSize(img.naturalWidth, img.naturalHeight, maxW, maxH);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas desteklenmiyor');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Barkod/OCR için daha yüksek çözünürlüklü bir canvas (sıkıştırma kaliteyi düşürmesin) */
export async function fileToCanvas(file: Blob, maxSide = 2000): Promise<HTMLCanvasElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const { width, height } = fitSize(img.naturalWidth, img.naturalHeight, maxSide, maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas desteklenmiyor');
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function scaleCanvas(source: HTMLCanvasElement, scale: number, rotate90 = false): HTMLCanvasElement {
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = rotate90 ? h : w;
  canvas.height = rotate90 ? w : h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;
  if (rotate90) {
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
  }
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}
