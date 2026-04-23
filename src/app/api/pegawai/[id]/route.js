import { z } from "zod";
import { filterPegawaiByRole, getPegawaiWilayah } from "@/lib/auth/access";
import { requireAuth } from "@/lib/auth/requireAuth";
import { fail, ok } from "@/lib/helpers/response";
import { deletePegawaiData, getPegawaiData, getPegawaiDetailData, getUkpdData, updatePegawaiData } from "@/lib/data/pegawaiStore";
import { deletePegawaiPhoto, getPegawaiPhotoUrl, savePegawaiPhoto } from "@/lib/helpers/pegawaiPhoto";

const schema = z.object({
  nama: z.string().min(3),
  nama_ukpd: z.string().min(3),
  jenis_pegawai: z.string().min(2),
  email: z.string().email().optional().or(z.literal(""))
}).passthrough();

function findAllowed(id, user, pegawaiMaster, ukpdList) {
  return filterPegawaiByRole(pegawaiMaster, user, ukpdList).find((item) => item.id_pegawai === Number(id));
}

function cleanNip(value) {
  return String(value || "").trim().replace(/^`+/, "");
}

export async function GET(_request, { params }) {
  const { user, error } = await requireAuth();
  if (error) return error;
  const [pegawaiMaster, ukpdList] = await Promise.all([getPegawaiData(), getUkpdData()]);
  const item = findAllowed(params.id, user, pegawaiMaster, ukpdList);
  if (!item) return fail("Data pegawai tidak ditemukan atau tidak dapat diakses.", 404);

  const detail = await getPegawaiDetailData(params.id);
  const alamat = detail.alamat || [];
  const alamatKtp = alamat.find((entry) => String(entry.tipe || "").toLowerCase() === "ktp");
  const alamatDomisili = alamat.find((entry) => String(entry.tipe || "").toLowerCase() === "domisili");

  return ok({
    ...item,
    nip: cleanNip(item.nip),
    wilayah: getPegawaiWilayah(item, ukpdList),
    photo_url: await getPegawaiPhotoUrl(params.id),
    alamat,
    alamat_ktp: alamatKtp?.alamat_lengkap || null,
    alamat_domisili: alamatDomisili?.alamat_lengkap || null,
    ...detail
  });
}

export async function PUT(request, { params }) {
  const { user, error } = await requireAuth();
  if (error) return error;
  const [pegawaiMaster, ukpdList] = await Promise.all([getPegawaiData(), getUkpdData()]);
  const current = findAllowed(params.id, user, pegawaiMaster, ukpdList);
  if (!current) return fail("Data pegawai tidak ditemukan atau tidak dapat diakses.", 404);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return fail("Validasi data pegawai gagal.", 422, parsed.error.flatten());

  const payload = { ...parsed.data };
  const photoUpload = payload.photo_upload;
  delete payload.photo_upload;

  const updated = { ...current, ...payload, id_pegawai: Number(params.id) };
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
  const [pegawaiMaster, ukpdList] = await Promise.all([getPegawaiData(), getUkpdData()]);
  const current = findAllowed(params.id, user, pegawaiMaster, ukpdList);
  if (!current) return fail("Data pegawai tidak ditemukan atau tidak dapat diakses.", 404);
  const deleted = await deletePegawaiData(params.id);
  await deletePegawaiPhoto(params.id);
  return ok(deleted, "Pegawai berhasil dihapus");
}
