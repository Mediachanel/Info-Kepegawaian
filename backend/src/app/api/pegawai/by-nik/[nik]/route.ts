import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/json";

const fetchPegawaiDetail = async (id: bigint, pegawai: Record<string, any>) => {
  const [alamat, pasanganRows, anak] = await Promise.all([
    prisma.alamat.findMany({ where: { id_pegawai: id } }),
    prisma.$queryRawUnsafe("SELECT * FROM pasangan WHERE id_pegawai = ? LIMIT 1", id),
    prisma.anak.findMany({ where: { id_pegawai: id }, orderBy: { urutan: "asc" } }),
  ]);
  const pasangan = Array.isArray(pasanganRows) ? pasanganRows[0] : pasanganRows;

  const [
    gaji_pokok,
    hukuman_disiplin,
    jabatan_fungsional,
    jabatan_struktural,
    pangkat,
    pendidikan_formal,
    pendidikan_nonformal,
    penghargaan,
    skp,
  ] = await Promise.all([
    prisma.$queryRawUnsafe(
      "SELECT * FROM drh_gaji_pokok WHERE id_pegawai = ? ORDER BY tmt DESC",
      id
    ),
    prisma.$queryRawUnsafe(
      "SELECT * FROM drh_hukuman_disiplin WHERE id_pegawai = ? ORDER BY tanggal_mulai DESC",
      id
    ),
    prisma.$queryRawUnsafe(
      "SELECT * FROM drh_jabatan_fungsional WHERE id_pegawai = ? ORDER BY tmt DESC",
      id
    ),
    prisma.$queryRawUnsafe(
      "SELECT * FROM drh_jabatan_struktural WHERE id_pegawai = ? ORDER BY tmt DESC",
      id
    ),
    prisma.$queryRawUnsafe(
      "SELECT * FROM drh_pangkat WHERE id_pegawai = ? ORDER BY tmt DESC",
      id
    ),
    prisma.$queryRawUnsafe(
      "SELECT * FROM drh_pendidikan_formal WHERE id_pegawai = ? ORDER BY tanggal_ijazah DESC",
      id
    ),
    prisma.$queryRawUnsafe(
      "SELECT * FROM drh_pendidikan_nonformal WHERE id_pegawai = ? ORDER BY tanggal_ijazah DESC",
      id
    ),
    prisma.$queryRawUnsafe(
      "SELECT * FROM drh_penghargaan WHERE id_pegawai = ? ORDER BY tanggal_sk DESC",
      id
    ),
    prisma.$queryRawUnsafe(
      "SELECT * FROM drh_skp WHERE id_pegawai = ? ORDER BY tahun DESC",
      id
    ),
  ]);

  return jsonSafe({
    ...pegawai,
    alamat,
    pasangan,
    anak,
    gaji_pokok,
    hukuman_disiplin,
    jabatan_fungsional,
    jabatan_struktural,
    pangkat,
    pendidikan_formal,
    pendidikan_nonformal,
    penghargaan,
    skp,
  });
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { nik: string } }
) {
  try {
    const nik = String(params.nik || "").trim();
    if (!nik) {
      return NextResponse.json({ error: "NIK is required" }, { status: 400 });
    }

    const pegawaiRows = await prisma.$queryRawUnsafe<any[]>(
      "SELECT * FROM pegawai_master WHERE nik = ? LIMIT 1",
      nik
    );
    const pegawai = Array.isArray(pegawaiRows) ? pegawaiRows[0] : null;

    if (!pegawai?.id_pegawai) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const id = BigInt(pegawai.id_pegawai);
    return NextResponse.json(await fetchPegawaiDetail(id, pegawai));
  } catch (error) {
    console.error("Error fetching pegawai by nik:", error);
    return NextResponse.json(
      { error: "Failed to fetch pegawai by nik" },
      { status: 500 }
    );
  }
}
