import { z } from "zod";
import { filterPegawaiByRole, getPegawaiWilayah } from "@/lib/auth/access";
import { requireAuth } from "@/lib/auth/requireAuth";
import { fail, ok } from "@/lib/helpers/response";
import { deletePegawaiData, getPegawaiById, getPegawaiDetailData, getUkpdData, updatePegawaiData } from "@/lib/data/pegawaiStore";
import { deletePegawaiPhoto, getPegawaiPhotoUrl, savePegawaiPhoto } from "@/lib/helpers/pegawaiPhoto";

const schema = z.object({
  nama: z.string().min(3),
  nama_ukpd: z.string().min(3),
  jenis_pegawai: z.string().min(2),
  email: z.string().email().optional().or(z.literal(""))
}).passthrough();

function cleanNip(value) {
  return String(value || "").trim().replace(/^`+/, "");
}

export async function GET(_request, { params }) {
  const { user, error } = await requireAuth();
  if (error) return error;
  const [item, ukpdList] = await Promise.all([getPegawaiById(params.id), getUkpdData()]);
  const allowedItem = item ? filterPegawaiByRole([item], user, ukpdList)[0] : null;
  const detailPromise = allowedItem ? getPegawaiDetailData(params.id) : Promise.resolve(null);
  const photoPromise = allowedItem ? getPegawaiPhotoUrl(params.id) : Promise.resolve(null);
  if (!allowedItem) return fail("Data pegawai tidak ditemukan atau tidak dapat diakses.", 404);

  const [detail, photoUrl] = await Promise.all([detailPromise, photoPromise]);
  const itemForResponse = allowedItem;
  const alamat = detail.alamat || [];
  const alamatKtp = alamat.find((entry) => String(entry.tipe || "").toLowerCase() === "ktp");
  const alamatDomisili = alamat.find((entry) => String(entry.tipe || "").toLowerCase() === "domisili");

  return ok({
    ...itemForResponse,
    nip: cleanNip(itemForResponse.nip),
    wilayah: getPegawaiWilayah(itemForResponse, ukpdList),
    photo_url: photoUrl,
    alamat,
    alamat_ktp: alamatKtp?.alamat_lengkap || null,
    alamat_domisili: alamatDomisili?.alamat_lengkap || null,
    ...detail
  });
}

export async function PUT(request, { params }) {
  const { user, error } = await requireAuth();
  if (error) return error;
  const [current, ukpdList] = await Promise.all([getPegawaiById(params.id), getUkpdData()]);
  const allowedCurrent = current ? filterPegawaiByRole([current], user, ukpdList)[0] : null;
  const currentForUpdate = allowedCurrent;
  if (!currentForUpdate) return fail("Data pegawai tidak ditemukan atau tidak dapat diakses.", 404);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return fail("Validasi data pegawai gagal.", 422, parsed.error.flatten());

  const payload = { ...parsed.data };
  const photoUpload = payload.photo_upload;
  delete payload.photo_upload;

  const updated = { ...currentForUpdate, ...payload, id_pegawai: Number(params.id) };
  const allowed = filterPegawaiByRole([updated], user, ukpdList).length === 1;
  if (!allowed) return fail("Anda tidak boleh memindahkan pegawai ke UKPD atau wilayah lain.", 403);
  const saved = await updatePegawaiData(params.id, payload);
  if (photoUpload) {
    await savePegawaiPhoto(params.id, photoUpload);
  }
  return ok({ ...saved, photo_url: await getPegawaiPhotoUrl(params.id) }, "Pegawai berhasil diperbarui");
}

export async function DELETE(_request, { params }) {
  const { user, error } = await requireAuth();
  if (error) return error;
  const [current, ukpdList] = await Promise.all([getPegawaiById(params.id), getUkpdData()]);
  const allowedCurrent = current ? filterPegawaiByRole([current], user, ukpdList)[0] : null;
  if (!allowedCurrent) return fail("Data pegawai tidak ditemukan atau tidak dapat diakses.", 404);
  const deleted = await deletePegawaiData(params.id);
  await deletePegawaiPhoto(params.id);
  return ok(deleted, "Pegawai berhasil dihapus");
}
