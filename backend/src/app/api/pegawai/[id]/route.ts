import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/json";
import { fetchLegacyPegawaiById } from "../_legacy";

const MASTER_COLUMNS = [
  "nama_ukpd",
  "nama",
  "kondisi",
  "nama_jabatan_orb",
  "nama_jabatan_menpan",
  "struktur_atasan_langsung",
  "jenis_pegawai",
  "status_rumpun",
  "jenis_kontrak",
  "nrk",
  "nip",
  "pangkat_golongan",
  "tmt_pangkat_terakhir",
  "jenis_kelamin",
  "tmt_kerja_ukpd",
  "tempat_lahir",
  "tanggal_lahir",
  "nik",
  "agama",
  "jenjang_pendidikan",
  "program_studi",
  "nama_universitas",
  "no_hp_pegawai",
  "email",
  "no_bpjs",
  "gelar_depan",
  "gelar_belakang",
  "status_perkawinan",
];

const normalizeValue = (value: any) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
};

const buildUpdate = (table: string, columns: string[]) => {
  const assignments = columns.map((col) => `${col} = ?`).join(", ");
  return `UPDATE ${table} SET ${assignments} WHERE id_pegawai = ?`;
};

const buildInsert = (table: string, columns: string[]) => {
  const cols = columns.join(", ");
  const placeholders = columns.map(() => "?").join(", ");
  return `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`;
};

const insertChildRows = async (
  table: string,
  columns: string[],
  id: bigint,
  rows: Array<Record<string, any>>
) => {
  if (!rows || rows.length === 0) return;
  const sql = buildInsert(table, ["id_pegawai", ...columns]);
  for (const row of rows) {
    const payload = columns.map((col) => normalizeValue(row[col]));
    if (!payload.some((val) => val !== null && val !== undefined && val !== "")) {
      continue;
    }
    const values = [id, ...payload];
    await prisma.$executeRawUnsafe(sql, ...values);
  }
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pegawai = await fetchLegacyPegawaiById(String(params.id || ""));

    if (!pegawai) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(jsonSafe(pegawai));
  } catch (error) {
    console.error('Error fetching pegawai detail:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pegawai' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = BigInt(params.id);
    const body = await request.json();
    const master = body?.master || body || {};

    const values = MASTER_COLUMNS.map((col) => normalizeValue(master[col]));
    const updateSql = buildUpdate("pegawai_master", MASTER_COLUMNS);
    await prisma.$executeRawUnsafe(updateSql, ...values, id);

    const alamatRows = Array.isArray(body?.alamat)
      ? body.alamat.filter((row: any) => row && row.tipe)
      : [];
    const pasangan = body?.pasangan ? [body.pasangan] : [];
    const anakRows = Array.isArray(body?.anak)
      ? body.anak.filter((row: any) => row && (row.nama || row.urutan))
      : [];

    await prisma.alamat.deleteMany({ where: { id_pegawai: id } });
    await prisma.pasangan.deleteMany({ where: { id_pegawai: id } });
    await prisma.anak.deleteMany({ where: { id_pegawai: id } });

    await prisma.alamat.createMany({
      data: alamatRows.map((row: any) => ({
        id_pegawai: id,
        tipe: row.tipe,
        jalan: normalizeValue(row.jalan),
        kelurahan: normalizeValue(row.kelurahan),
        kecamatan: normalizeValue(row.kecamatan),
        kota_kabupaten: normalizeValue(row.kota_kabupaten),
        provinsi: normalizeValue(row.provinsi),
        kode_provinsi: normalizeValue(row.kode_provinsi),
        kode_kota_kab: normalizeValue(row.kode_kota_kab),
        kode_kecamatan: normalizeValue(row.kode_kecamatan),
        kode_kelurahan: normalizeValue(row.kode_kelurahan),
      })),
      skipDuplicates: true,
    });
    if (pasangan.length && Object.values(pasangan[0] || {}).some((val) => val)) {
      await prisma.pasangan.create({
        data: {
          id_pegawai: id,
          status_punya: pasangan[0].status_punya || null,
          nama: normalizeValue(pasangan[0].nama),
          no_tlp: normalizeValue(pasangan[0].no_tlp),
          email: normalizeValue(pasangan[0].email),
          pekerjaan: normalizeValue(pasangan[0].pekerjaan),
        },
      });
    }
    await prisma.anak.createMany({
      data: anakRows.map((row: any, idx: number) => ({
        id_pegawai: id,
        urutan: Number(row.urutan) || idx + 1,
        nama: normalizeValue(row.nama),
        jenis_kelamin: row.jenis_kelamin || null,
        tempat_lahir: normalizeValue(row.tempat_lahir),
        tanggal_lahir: normalizeValue(row.tanggal_lahir),
        pekerjaan: normalizeValue(row.pekerjaan),
      })),
      skipDuplicates: true,
    });

    await prisma.$executeRawUnsafe("DELETE FROM drh_gaji_pokok WHERE id_pegawai = ?", id);
    await prisma.$executeRawUnsafe("DELETE FROM drh_hukuman_disiplin WHERE id_pegawai = ?", id);
    await prisma.$executeRawUnsafe("DELETE FROM drh_jabatan_fungsional WHERE id_pegawai = ?", id);
    await prisma.$executeRawUnsafe("DELETE FROM drh_jabatan_struktural WHERE id_pegawai = ?", id);
    await prisma.$executeRawUnsafe("DELETE FROM drh_pangkat WHERE id_pegawai = ?", id);
    await prisma.$executeRawUnsafe("DELETE FROM drh_pendidikan_formal WHERE id_pegawai = ?", id);
    await prisma.$executeRawUnsafe("DELETE FROM drh_pendidikan_nonformal WHERE id_pegawai = ?", id);
    await prisma.$executeRawUnsafe("DELETE FROM drh_penghargaan WHERE id_pegawai = ?", id);
    await prisma.$executeRawUnsafe("DELETE FROM drh_skp WHERE id_pegawai = ?", id);

    await insertChildRows("drh_gaji_pokok", ["tmt", "pangkat", "gaji", "no_sk", "tanggal_sk"], id, body?.gaji_pokok || []);
    await insertChildRows(
      "drh_hukuman_disiplin",
      ["tanggal_mulai", "tanggal_akhir", "jenis_hukuman", "no_sk", "tanggal_sk", "keterangan"],
      id,
      body?.hukuman_disiplin || []
    );
    await insertChildRows(
      "drh_jabatan_fungsional",
      ["tmt", "jabatan", "pangkat", "no_sk", "tanggal_sk"],
      id,
      body?.jabatan_fungsional || []
    );
    await insertChildRows(
      "drh_jabatan_struktural",
      ["tmt", "lokasi", "jabatan", "pangkat", "eselon", "no_sk", "tanggal_sk"],
      id,
      body?.jabatan_struktural || []
    );
    await insertChildRows("drh_pangkat", ["tmt", "pangkat", "lokasi", "no_sk", "tanggal_sk"], id, body?.pangkat || []);
    await insertChildRows(
      "drh_pendidikan_formal",
      ["tingkat", "jurusan", "tanggal_ijazah", "nama_sekolah", "kota"],
      id,
      body?.pendidikan_formal || []
    );
    await insertChildRows(
      "drh_pendidikan_nonformal",
      ["nama_pelatihan", "tanggal_ijazah", "penyelenggara", "kota"],
      id,
      body?.pendidikan_nonformal || []
    );
    await insertChildRows(
      "drh_penghargaan",
      ["nama_penghargaan", "asal_penghargaan", "no_sk", "tanggal_sk"],
      id,
      body?.penghargaan || []
    );
    await insertChildRows(
      "drh_skp",
      ["tahun", "nilai_skp", "nilai_perilaku", "nilai_prestasi", "keterangan"],
      id,
      body?.skp || []
    );

    return NextResponse.json(jsonSafe({ ok: true }));
  } catch (error) {
    console.error("Error updating pegawai:", error);
    return NextResponse.json(
      { error: "Failed to update pegawai" },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
