import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/json";

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

    const andFilters: any[] = [];
    if (unit) {
      andFilters.push({ nama_ukpd: unit });
    }
    if (!unit && wilayah) {
      const ukpdRows = await prisma.ukpd.findMany({
        where: { wilayah },
        select: { nama_ukpd: true },
      });
      const ukpdNames = ukpdRows.map((row) => row.nama_ukpd).filter(Boolean);
      if (ukpdNames.length === 0) {
        return NextResponse.json(jsonSafe({ rows: [], limit: take, offset: skip, total: 0 }));
      }
      andFilters.push({ nama_ukpd: { in: ukpdNames } });
    }
    if (jabatan) {
      andFilters.push({ nama_jabatan_orb: { contains: jabatan } });
    }
    if (statusList.length === 1) {
      andFilters.push({ jenis_pegawai: statusList[0] });
    } else if (statusList.length > 1) {
      andFilters.push({ jenis_pegawai: { in: statusList } });
    }
    if (search) {
      andFilters.push({
        OR: [
          { nama: { contains: search } },
          { nip: { contains: search } },
        ],
      });
    }
    const whereClause = andFilters.length > 0 ? { AND: andFilters } : undefined;

    if (full) {
      const clauseParts: string[] = [];
      const params: any[] = [];
      if (unit) {
        clauseParts.push("nama_ukpd = ?");
        params.push(unit);
      } else if (wilayah) {
        const ukpdRows = await prisma.ukpd.findMany({
          where: { wilayah },
          select: { nama_ukpd: true },
        });
        const ukpdNames = ukpdRows.map((row) => row.nama_ukpd).filter(Boolean);
        if (ukpdNames.length === 0) {
          return NextResponse.json(jsonSafe({ rows: [], limit: take, offset: skip, total: 0 }));
        }
        clauseParts.push(`nama_ukpd IN (${ukpdNames.map(() => "?").join(",")})`);
        params.push(...ukpdNames);
      }
      if (jabatan) {
        clauseParts.push("nama_jabatan_orb LIKE ?");
        params.push(`%${jabatan}%`);
      }
      if (statusList.length === 1) {
        clauseParts.push("jenis_pegawai = ?");
        params.push(statusList[0]);
      } else if (statusList.length > 1) {
        clauseParts.push(`jenis_pegawai IN (${statusList.map(() => "?").join(",")})`);
        params.push(...statusList);
      }
      if (search) {
        clauseParts.push("(nama LIKE ? OR nip LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }
      const whereSql = clauseParts.length ? `WHERE ${clauseParts.join(" AND ")}` : "";
      const totalRows = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
        `SELECT COUNT(*) AS total FROM pegawai_master ${whereSql}`,
        ...params
      );
      const total = Number(totalRows?.[0]?.total || 0);
      const rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM pegawai_master ${whereSql} ORDER BY id_pegawai ASC LIMIT ? OFFSET ?`,
        ...params,
        take,
        skip
      );
      return NextResponse.json(jsonSafe({ rows, limit: take, offset: skip, total }));
    }

    const total = await prisma.pegawai_master.count({
      where: whereClause,
    });

    const pegawai = await prisma.pegawai_master.findMany({
      take,
      skip,
      orderBy: { id_pegawai: "asc" },
      where: whereClause,
      ...(lite
        ? {
            select: {
              id_pegawai: true,
              nama_ukpd: true,
              nama: true,
              nip: true,
              nrk: true,
              kondisi: true,
              nama_jabatan_orb: true,
              nama_jabatan_menpan: true,
              status_rumpun: true,
              jenis_pegawai: true,
            },
          }
        : {}),
    });

    return NextResponse.json(jsonSafe({ rows: pegawai, limit: take, offset: skip, total }));
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
