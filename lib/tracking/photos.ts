/** Turn browser object URLs into photo data before persisting a draft. */
export async function durablePhoto(uri: string): Promise<string> {
  if (!uri.startsWith("blob:")) return uri;
  const blob = await readPhoto(uri);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("We couldn’t keep this photo. Please take it again."));
    reader.readAsDataURL(blob);
  });
}

export async function readPhoto(uri: string): Promise<Blob> {
  try {
    const response = await fetch(uri);
    if (!response.ok) throw new Error("Photo unavailable");
    const blob = await response.blob();
    if (!blob.size) throw new Error("Empty photo");
    return blob;
  } catch {
    throw new Error("This photo is no longer available. Go back and retake or remove it, then publish again. Your written draft is safe.");
  }
}
