export function getNombreArchivo(url: string, fallback = 'documento'): string {
  if (!url) return fallback;
  if (url.includes('#name=')) {
    try {
      const match = url.split('#name=')[1];
      if (match) return decodeURIComponent(match);
    } catch {
      // ignore
    }
  }
  if (url.startsWith('data:')) {
    if (url.includes('image/')) return 'fotografia.jpg';
    if (url.includes('pdf')) return 'documento.pdf';
    return fallback;
  }
  const clean = url.split('?')[0];
  const last = clean.split('/').pop();
  return last ? decodeURIComponent(last) : fallback;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export async function compressImageToDataUrl(file: File, maxDim = 1200, quality = 0.8): Promise<string> {
  if (!file.type.startsWith('image/')) {
    const dataUrl = await readFileAsDataUrl(file);
    return `${dataUrl}#name=${encodeURIComponent(file.name)}`;
  }
  return new Promise((resolve) => {
    const img = new Image();
    const tempUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(tempUrl);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        readFileAsDataUrl(file)
          .then((du) => resolve(`${du}#name=${encodeURIComponent(file.name)}`))
          .catch(() => resolve(tempUrl));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(`${dataUrl}#name=${encodeURIComponent(file.name)}`);
    };
    img.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      readFileAsDataUrl(file)
        .then((du) => resolve(`${du}#name=${encodeURIComponent(file.name)}`))
        .catch(() => resolve(tempUrl));
    };
    img.src = tempUrl;
  });
}

export async function processDocumentFile(file: File): Promise<string> {
  if (file.size > 12 * 1024 * 1024) {
    throw new Error(`El archivo "${file.name}" supera el tamaño máximo permitido de 12 MB.`);
  }
  const dataUrl = await readFileAsDataUrl(file);
  return `${dataUrl}#name=${encodeURIComponent(file.name)}`;
}
