import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  TABLE_NAME,
  asNullable,
  asSmallInt,
  ensureMutasiTable,
  jsonResponse,
  normalizeChecklist,
} from "./_shared";

export async function GET(request: NextRequest) {
  try {
    await ensureMutasiTable();

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") || "").trim();
    const createdByUkpd = (searchParams.get("created_by_ukpd") || "").trim();
    const q = (searchParams.get("q") || "").trim();
    const limitParsed = Number(searchParams.get("limit") || "100");
    const offsetParsed = Number(searchParams.get("offset") || "0");
    const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? Math.min(limitParsed, 500) : 100;
    const offset = Number.isFinite(offsetParsed) && offsetParsed > 0 ? offsetParsed : 0;

    const clauses: string[] = [];
    const params: any[] = [];

    if (status) {
      clauses.push("status = ?");
      params.push(status);
    }

    if (createdByUkpd) {
      clauses.push("created_by_ukpd = ?");
      params.push(createdByUkpd);
    }

    if (q) {
      clauses.push("(nip LIKE ? OR nama_pegawai LIKE ? OR nama_ukpd LIKE ? OR ukpd_tujuan LIKE ? OR jabatan LIKE ? OR jabatan_baru LIKE ?)");
      const wildcard = `%${q}%`;
      params.push(wildcard, wildcard, wildcard, wildcard, wildcard, wildcard);
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const totalRows = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
      `SELECT COUNT(*) AS total FROM ${TABLE_NAME} ${whereSql}`,
      ...params
    );

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM ${TABLE_NAME} ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset
    );

    return jsonResponse({
      ok: true,
      rows,
      total: Number(totalRows?.[0]?.total || 0),
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching usulan mutasi:", error);
    return jsonResponse({ error: "Failed to fetch usulan mutasi" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureMutasiTable();
    const body = await request.json();

    const sql = `
      INSERT INTO ${TABLE_NAME} (
        nip, nama_pegawai, gelar_depan, gelar_belakang, pangkat_golongan, jabatan,
        abk_j_lama, bezetting_j_lama, nonasn_bezetting_lama, nonasn_abk_lama,
        jabatan_baru, abk_j_baru, bezetting_j_baru, nonasn_bezetting_baru, nonasn_abk_baru,
        nama_ukpd, ukpd_tujuan, alasan, tanggal_usulan, status, berkas_path,
        created_by_ukpd, keterangan, mutasi_id, jenis_mutasi, verif_checklist
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `;

    await prisma.$executeRawUnsafe(
      sql,
      String(body?.nip || "").trim(),
      String(body?.nama_pegawai || "").trim(),
      asNullable(body?.gelar_depan),
      asNullable(body?.gelar_belakang),
      asNullable(body?.pangkat_golongan),
      asNullable(body?.jabatan),
      asSmallInt(body?.abk_j_lama),
      asSmallInt(body?.bezetting_j_lama),
      asSmallInt(body?.nonasn_bezetting_lama),
      asSmallInt(body?.nonasn_abk_lama),
      asNullable(body?.jabatan_baru),
      asSmallInt(body?.abk_j_baru),
      asSmallInt(body?.bezetting_j_baru),
      asSmallInt(body?.nonasn_bezetting_baru),
      asSmallInt(body?.nonasn_abk_baru),
      asNullable(body?.nama_ukpd),
      asNullable(body?.ukpd_tujuan),
      String(body?.alasan || "").trim(),
      asNullable(body?.tanggal_usulan),
      asNullable(body?.status || "DRAFT"),
      asNullable(body?.berkas_path),
      asNullable(body?.created_by_ukpd),
      asNullable(body?.keterangan),
      asNullable(body?.mutasi_id),
      asNullable(body?.jenis_mutasi || "Mutasi"),
      normalizeChecklist(body?.verif_checklist)
    );

    const [{ id }] = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
      "SELECT LAST_INSERT_ID() AS id"
    );

    return jsonResponse({
      ok: true,
      id: Number(id),
      message: "Usulan mutasi berhasil disimpan.",
    });
  } catch (error) {
    console.error("Error creating usulan mutasi:", error);
    return jsonResponse({ error: "Failed to create usulan mutasi" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return jsonResponse(null, { status: 200 });
}
