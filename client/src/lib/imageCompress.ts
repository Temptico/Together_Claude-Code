// Photos are stored as base64 directly in the database, so they're kept
// deliberately small — this is a thumbnail-sized memory of the date, not a
// full-resolution photo library. ~900px/0.6 quality keeps typical uploads
// under ~150-250KB instead of 1-3MB, which matters for free-tier DB storage.
export function compressImageFile(file: File, maxDim = 900, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Napaka pri branju slike"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Neveljavna slika"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Stiskanje slike ni podprto"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
