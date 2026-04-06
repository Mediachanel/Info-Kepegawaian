import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/json";

type PegawaiRow = {
  id_pegawai: bigint | number;
  nik?: string;
  nip?: string;
  nrk?: string;
  nama?: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  nama_jabatan_orb?: string;
  status_rumpun?: string;
  pangkat_golongan?: string;
  tmt_pangkat_terakhir?: string;
  nama_ukpd?: string;
};

const groupById = <T extends Record<string, any>>(rows: T[], key = "id_pegawai") => {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const id = String(row[key]);
    const list = map.get(id) || [];
    list.push(row);
    map.set(id, list);
  }
  return map;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unit = (searchParams.get("unit") || "").trim();

    const baseSql = `
      SELECT id_pegawai, nik, nip, nrk, nama, tempat_lahir, tanggal_lahir,
             nama_jabatan_orb, status_rumpun, pangkat_golongan, tmt_pangkat_terakhir, nama_ukpd
      FROM pegawai_master
      WHERE UPPER(TRIM(jenis_pegawai)) = 'PNS'
      ${unit ? "AND nama_ukpd = ?" : ""}
      ORDER BY pangkat_golongan DESC,
               COALESCE(tmt_pangkat_terakhir,'0000-00-00') ASC,
               COALESCE(tanggal_lahir,'0000-00-00') ASC,
               nama ASC
    `;
    const pegawai = await prisma.$queryRawUnsafe<PegawaiRow[]>(baseSql, ...(unit ? [unit] : []));
    const ids = pegawai.map((row) => row.id_pegawai).filter(Boolean);
    if (!ids.length) {
      return NextResponse.json(jsonSafe({ rows: [], unit, total: 0 }));
    }

    const placeholders = ids.map(() => "?").join(",");
    const params = [...ids];

    const pangkatRows = await prisma.$queryRawUnsafe(
      `SELECT id_pegawai, tmt, pangkat, lokasi, no_sk, tanggal_sk
       FROM drh_pangkat
       WHERE id_pegawai IN (${placeholders})
       ORDER BY COALESCE(tmt,'0000-00-00') DESC, id DESC`,
      ...params
    );

    const pendidikanFormalRows = await prisma.$queryRawUnsafe(
      `SELECT id_pegawai, tingkat, jurusan, tanggal_ijazah, nama_sekolah, kota
       FROM drh_pendidikan_formal
       WHERE id_pegawai IN (${placeholders})
       ORDER BY COALESCE(tanggal_ijazah,'0000-00-00') DESC, id DESC`,
      ...params
    );

    const pendidikanNonformalRows = await prisma.$queryRawUnsafe(
      `SELECT id_pegawai, nama_pelatihan, tanggal_ijazah, penyelenggara, kota
       FROM drh_pendidikan_nonformal
       WHERE id_pegawai IN (${placeholders})
       ORDER BY COALESCE(tanggal_ijazah,'0000-00-00') DESC, id DESC`,
      ...params
    );

    const jabatanStrRows = await prisma.$queryRawUnsafe(
      `SELECT id_pegawai, tmt, jabatan, lokasi
       FROM drh_jabatan_struktural
       WHERE id_pegawai IN (${placeholders})
       ORDER BY COALESCE(tmt,'0000-00-00') DESC, id DESC`,
      ...params
    );

    const jabatanFunRows = await prisma.$queryRawUnsafe(
      `SELECT id_pegawai, tmt, jabatan, '' AS lokasi
       FROM drh_jabatan_fungsional
       WHERE id_pegawai IN (${placeholders})
       ORDER BY COALESCE(tmt,'0000-00-00') DESC, id DESC`,
      ...params
    );

    const pangkatMap = groupById(pangkatRows as any[]);
    const pendFormalMap = groupById(pendidikanFormalRows as any[]);
    const pendNonMap = groupById(pendidikanNonformalRows as any[]);
    const jabatanMap = groupById([...(jabatanStrRows as any[]), ...(jabatanFunRows as any[])]);

    const rows = pegawai.map((row) => {
      const id = String(row.id_pegawai);
      return {
        ...row,
        pangkat: pangkatMap.get(id) || [],
        pendidikan_formal: pendFormalMap.get(id) || [],
        pendidikan_nonformal: pendNonMap.get(id) || [],
        jabatan: jabatanMap.get(id) || [],
      };
    });

    return NextResponse.json(jsonSafe({ rows, unit, total: rows.length }));
  } catch (error) {
    console.error("Error fetching DUK:", error);
    return NextResponse.json({ error: "Failed to fetch DUK" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
