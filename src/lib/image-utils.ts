export function convertGoogleDriveUrl(value: string) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  if (url.startsWith("data:image/")) return url;
  const match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match?.[1]) return `https://lh3.googleusercontent.com/d/${match[1]}`;
  return url;
}

export function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
