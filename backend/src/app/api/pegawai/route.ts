import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/json";
import { fetchLegacyPegawaiList } from "./_legacy";

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitRaw = searchParams.get("limit");
    const offsetRaw = searchParams.get("offset");
    const liteRaw = searchParams.get("lite");
    const fullRaw = searchParams.get("full");
    const unitRaw = searchParams.get("unit");
    const wilayahRaw = searchParams.get("wilayah");
    const jabatanRaw = searchParams.get("jabatan");
    const statusRaw = searchParams.get("status");
    const searchRaw = searchParams.get("search");
    const limitParsed = limitRaw ? Number(limitRaw) : NaN;
    const offsetParsed = offsetRaw ? Number(offsetRaw) : NaN;
    const DEFAULT_LIMIT = 1000;
    const MAX_LIMIT = 5000;
    const take = Number.isFinite(limitParsed) && limitParsed > 0
      ? Math.min(limitParsed, MAX_LIMIT)
      : DEFAULT_LIMIT;
    const skip = Number.isFinite(offsetParsed) && offsetParsed > 0 ? offsetParsed : 0;
    const lite = liteRaw === "1" || liteRaw === "true";
    const full = fullRaw === "1" || fullRaw === "true";
    const unit = unitRaw ? unitRaw.trim() : "";
    const wilayah = wilayahRaw ? wilayahRaw.trim() : "";
    const jabatan = jabatanRaw ? jabatanRaw.trim() : "";
    const statusList = statusRaw
      ? statusRaw.split(",").map((val) => val.trim()).filter(Boolean)
      : [];
    const search = searchRaw ? searchRaw.trim() : "";

    const result = await fetchLegacyPegawaiList({
      limit: take,
      offset: skip,
      unit,
      wilayah,
      jabatan,
      statusList,
      search,
    });

    const rows = lite
      ? result.rows.map((row) => ({
          id_pegawai: row.id_pegawai,
          nama_ukpd: row.nama_ukpd,
          nama: row.nama,
          nip: row.nip,
          nrk: row.nrk,
          nik: row.nik,
          kondisi: row.kondisi,
          nama_jabatan_orb: row.nama_jabatan_orb,
          nama_jabatan_menpan: row.nama_jabatan_menpan,
          status_rumpun: row.status_rumpun,
          jenis_pegawai: row.jenis_pegawai,
          wilayah: row.wilayah,
          wilayah_ukpd: row.wilayah_ukpd,
        }))
      : result.rows;

    return NextResponse.json(
      jsonSafe({
        rows,
        limit: take,
        offset: skip,
        total: result.total,
        full,
      })
    );
  } catch (error) {
    console.error('Error fetching pegawai:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pegawai' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const master = body?.master || body || {};

    const values = MASTER_COLUMNS.map((col) => normalizeValue(master[col]));
    const insertSql = buildInsert("pegawai_master", MASTER_COLUMNS);
    await prisma.$executeRawUnsafe(insertSql, ...values);

    const [{ id: insertedId }] = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
      "SELECT LAST_INSERT_ID() AS id"
    );
    const id = BigInt(insertedId);

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

    return NextResponse.json(jsonSafe({ ok: true, id }));
  } catch (error) {
    console.error("Error creating pegawai:", error);
    return NextResponse.json(
      { error: "Failed to create pegawai" },
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
