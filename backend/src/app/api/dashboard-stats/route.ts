import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/json";

type ColumnMap = Record<string, string[]>;

const COLUMN_CANDIDATES: ColumnMap = {
  status: ["jenis_pegawai", "nama_jenis_pegawai", "status_pegawai", "nama_status_aktif", "kondisi"],
  rumpun: ["status_rumpun", "nama_status_rumpun", "rumpun", "nama_rumpun"],
  pendidikan: ["jenjang_pendidikan", "pendidikan", "nama_pendidikan"],
  gender: ["jenis_kelamin", "gender"],
  marital: ["status_pernikahan", "status_perkawinan", "status_nikah"],
};

const resolveColumn = (columns: Set<string>, candidates?: string[]) => {
  if (!candidates) return undefined;
  return candidates.find((name) => columns.has(name));
};

const buildStatusExpr = (columns: Set<string>) => {
  const hasJenis = columns.has("jenis_pegawai");
  const hasKondisi = columns.has("kondisi");
  if (hasJenis && hasKondisi) {
    return "CASE WHEN p.jenis_pegawai IS NULL OR p.jenis_pegawai = '' THEN p.kondisi ELSE p.jenis_pegawai END";
  }
  if (hasJenis) return "p.jenis_pegawai";
  if (hasKondisi) return "p.kondisi";
  return undefined;
};

const buildWhere = (unit: string, ukpdNames: string[]) => {
  if (unit) return { clause: "WHERE p.nama_ukpd = ?", params: [unit] };
  if (ukpdNames.length) {
    const placeholders = ukpdNames.map(() => "?").join(",");
    return { clause: `WHERE p.nama_ukpd IN (${placeholders})`, params: ukpdNames };
  }
  return { clause: "", params: [] as string[] };
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unit = (searchParams.get("unit") || "").trim();
    const wilayah = (searchParams.get("wilayah") || "").trim();

    const columnRows = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pegawai_master'"
    );
    const columns = new Set(columnRows.map((row) => row.COLUMN_NAME));
    const statusCol = resolveColumn(columns, COLUMN_CANDIDATES.status);
    const statusExpr = buildStatusExpr(columns);
    const rumpunCol = resolveColumn(columns, COLUMN_CANDIDATES.rumpun);
    const pendidikanCol = resolveColumn(columns, COLUMN_CANDIDATES.pendidikan);
    const genderCol = resolveColumn(columns, COLUMN_CANDIDATES.gender);
    const maritalCol = resolveColumn(columns, COLUMN_CANDIDATES.marital);

    let ukpdNames: string[] = [];
    if (!unit && wilayah) {
      const ukpdRows = await prisma.ukpd.findMany({
        where: { wilayah },
        select: { nama_ukpd: true },
      });
      ukpdNames = ukpdRows.map((row) => row.nama_ukpd).filter(Boolean);
    }

    const wherePrisma =
      unit || ukpdNames.length
        ? {
            nama_ukpd: unit ? unit : { in: ukpdNames },
          }
        : undefined;

    const total = await prisma.pegawai_master.count({
      where: wherePrisma,
    });

    const { clause, params } = buildWhere(unit, ukpdNames);

    const statusCounts =
      statusExpr
        ? await prisma.$queryRawUnsafe(
            `SELECT ${statusExpr} AS status, COUNT(*) AS count FROM pegawai_master p ${clause} GROUP BY ${statusExpr}`,
            ...params
          )
        : [];

    const unitStatus =
      statusExpr
        ? await prisma.$queryRawUnsafe(
            `SELECT p.nama_ukpd AS unit, u.wilayah AS wilayah, ${statusExpr} AS status, COUNT(*) AS count
             FROM pegawai_master p
             LEFT JOIN ukpd u ON u.nama_ukpd = p.nama_ukpd
             ${clause}
             GROUP BY p.nama_ukpd, u.wilayah, ${statusExpr}`,
            ...params
          )
        : [];

    const rumpunStatus =
      statusExpr && rumpunCol
        ? await prisma.$queryRawUnsafe(
            `SELECT p.${rumpunCol} AS rumpun, ${statusExpr} AS status, COUNT(*) AS count
             FROM pegawai_master p
             ${clause}
             GROUP BY p.${rumpunCol}, ${statusExpr}`,
            ...params
          )
        : [];

    const pendidikanStatus =
      statusExpr && pendidikanCol
        ? await prisma.$queryRawUnsafe(
            `SELECT p.${pendidikanCol} AS pendidikan, ${statusExpr} AS status, COUNT(*) AS count
             FROM pegawai_master p
             ${clause}
             GROUP BY p.${pendidikanCol}, ${statusExpr}`,
            ...params
          )
        : [];

    const genderCounts =
      genderCol
        ? await prisma.$queryRawUnsafe(
            `SELECT p.${genderCol} AS gender, COUNT(*) AS count FROM pegawai_master p ${clause} GROUP BY p.${genderCol}`,
            ...params
          )
        : [];

    const maritalCounts =
      maritalCol
        ? await prisma.$queryRawUnsafe(
            `SELECT p.${maritalCol} AS marital, COUNT(*) AS count FROM pegawai_master p ${clause} GROUP BY p.${maritalCol}`,
            ...params
          )
        : [];

    const unitGender =
      genderCol
        ? await prisma.$queryRawUnsafe(
            `SELECT p.nama_ukpd AS unit, u.wilayah AS wilayah, p.${genderCol} AS gender, COUNT(*) AS count
             FROM pegawai_master p
             LEFT JOIN ukpd u ON u.nama_ukpd = p.nama_ukpd
             ${clause}
             GROUP BY p.nama_ukpd, u.wilayah, p.${genderCol}`,
            ...params
          )
        : [];

    const unitMarital =
      maritalCol
        ? await prisma.$queryRawUnsafe(
            `SELECT p.nama_ukpd AS unit, u.wilayah AS wilayah, p.${maritalCol} AS marital, COUNT(*) AS count
             FROM pegawai_master p
             LEFT JOIN ukpd u ON u.nama_ukpd = p.nama_ukpd
             ${clause}
             GROUP BY p.nama_ukpd, u.wilayah, p.${maritalCol}`,
            ...params
          )
        : [];

    const rumpunGender =
      genderCol && rumpunCol
        ? await prisma.$queryRawUnsafe(
            `SELECT p.${rumpunCol} AS rumpun, p.${genderCol} AS gender, COUNT(*) AS count
             FROM pegawai_master p
             ${clause}
             GROUP BY p.${rumpunCol}, p.${genderCol}`,
            ...params
          )
        : [];

    const rumpunMarital =
      maritalCol && rumpunCol
        ? await prisma.$queryRawUnsafe(
            `SELECT p.${rumpunCol} AS rumpun, p.${maritalCol} AS marital, COUNT(*) AS count
             FROM pegawai_master p
             ${clause}
             GROUP BY p.${rumpunCol}, p.${maritalCol}`,
            ...params
          )
        : [];

    const pendidikanGender =
      genderCol && pendidikanCol
        ? await prisma.$queryRawUnsafe(
            `SELECT p.${pendidikanCol} AS pendidikan, p.${genderCol} AS gender, COUNT(*) AS count
             FROM pegawai_master p
             ${clause}
             GROUP BY p.${pendidikanCol}, p.${genderCol}`,
            ...params
          )
        : [];

    const pendidikanMarital =
      maritalCol && pendidikanCol
        ? await prisma.$queryRawUnsafe(
            `SELECT p.${pendidikanCol} AS pendidikan, p.${maritalCol} AS marital, COUNT(*) AS count
             FROM pegawai_master p
             ${clause}
             GROUP BY p.${pendidikanCol}, p.${maritalCol}`,
            ...params
          )
        : [];

    return NextResponse.json(
      jsonSafe({
        ok: true,
        total,
        statusCounts,
        unitStatus,
        rumpunStatus,
        pendidikanStatus,
        genderCounts,
        maritalCounts,
        unitGender,
        unitMarital,
        rumpunGender,
        rumpunMarital,
        pendidikanGender,
        pendidikanMarital,
      })
    );
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}

export async function OPTIONS(_request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
