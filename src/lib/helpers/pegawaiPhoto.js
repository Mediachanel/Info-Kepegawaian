import { promises as fs } from "fs";
import path from "path";

const PHOTO_DIR = path.join(process.cwd(), "public", "FOTO");
const DEFAULT_PHOTO_FILENAME = "OIP.JPG";
const SUPPORTED_MIME_TYPES = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};
const ALL_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".JPG", ".JPEG", ".PNG", ".WEBP"];

async function ensurePhotoDir() {
  await fs.mkdir(PHOTO_DIR, { recursive: true });
}

function normalizeUpload(upload) {
  if (!upload || typeof upload !== "object") return null;
  const dataUrl = String(upload.dataUrl || "").trim();
  const mimeType = String(upload.type || "").trim().toLowerCase();
  if (!dataUrl || !mimeType || !SUPPORTED_MIME_TYPES[mimeType]) return null;

  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) return null;

  return {
    mimeType,
    extension: SUPPORTED_MIME_TYPES[mimeType],
    buffer: Buffer.from(match[2], "base64")
  };
}

async function removeExistingPegawaiPhotos(idPegawai) {
  await ensurePhotoDir();
  await Promise.all(
    ALL_EXTENSIONS.map(async (extension) => {
      const filepath = path.join(PHOTO_DIR, `${idPegawai}${extension}`);
      await fs.rm(filepath, { force: true }).catch(() => {});
    })
  );
}

export async function savePegawaiPhoto(idPegawai, upload) {
  const normalized = normalizeUpload(upload);
  if (!normalized) return null;

  await ensurePhotoDir();
  await removeExistingPegawaiPhotos(idPegawai);

  const filename = `${idPegawai}${normalized.extension}`;
  const filepath = path.join(PHOTO_DIR, filename);
  await fs.writeFile(filepath, normalized.buffer);
  return `/FOTO/${filename}`;
}

export async function getPegawaiPhotoUrl(idPegawai) {
  await ensurePhotoDir();

  for (const extension of ALL_EXTENSIONS) {
    const filename = `${idPegawai}${extension}`;
    const filepath = path.join(PHOTO_DIR, filename);
    try {
      const stat = await fs.stat(filepath);
      if (stat.isFile()) {
        return `/FOTO/${filename}?v=${stat.mtimeMs}`;
      }
    } catch {
      // ignore missing file variants
    }
  }

  return `/FOTO/${DEFAULT_PHOTO_FILENAME}`;
}

export async function deletePegawaiPhoto(idPegawai) {
  await removeExistingPegawaiPhotos(idPegawai);
}
