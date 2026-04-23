import { filterPegawaiByRole } from "@/lib/auth/access";
import { requireAuth } from "@/lib/auth/requireAuth";
import { getPegawaiData, getUkpdData } from "@/lib/data/pegawaiStore";
import { ok } from "@/lib/helpers/response";

function uniqueSorted(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
}

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const [pegawai, ukpdList] = await Promise.all([getPegawaiData(), getUkpdData()]);
  const scopedPegawai = filterPegawaiByRole(pegawai, user, ukpdList);
  const scopedUkpd = filterPegawaiByRole(
    ukpdList.map((item) => ({ nama_ukpd: item.nama_ukpd, wilayah: item.wilayah })),
    user,
    ukpdList
  );

  return ok({
    user,
    options: {
      ukpd: uniqueSorted(scopedUkpd.map((item) => item.nama_ukpd)),
      jabatan_orb: uniqueSorted(scopedPegawai.map((item) => item.nama_jabatan_orb)),
      jabatan_menpan: uniqueSorted(scopedPegawai.map((item) => item.nama_jabatan_menpan || item.nama_jabatan_orb)),
      rumpun: uniqueSorted(scopedPegawai.map((item) => item.status_rumpun)),
      pangkat_golongan: uniqueSorted(scopedPegawai.map((item) => item.pangkat_golongan)),
      agama: uniqueSorted(scopedPegawai.map((item) => item.agama)),
      jenis_kelamin: uniqueSorted(scopedPegawai.map((item) => item.jenis_kelamin)),
      jenis_pegawai: uniqueSorted(scopedPegawai.map((item) => item.jenis_pegawai)),
      jenis_kontrak: uniqueSorted(scopedPegawai.map((item) => item.jenis_kontrak)),
      jenjang_pendidikan: uniqueSorted(scopedPegawai.map((item) => item.jenjang_pendidikan))
    }
  });
}
