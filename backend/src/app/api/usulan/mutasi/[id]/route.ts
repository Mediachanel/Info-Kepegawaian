import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  TABLE_NAME,
  asNullable,
  asSmallInt,
  ensureMutasiTable,
  jsonResponse,
  normalizeChecklist,
} from "../_shared";

const parseId = (value: string) => {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureMutasiTable();
    const id = parseId(params.id);
    if (!id) {
      return jsonResponse({ error: "Invalid id" }, { status: 400 });
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM ${TABLE_NAME} WHERE id = ? LIMIT 1`,
      id
    );

    if (!rows.length) {
      return jsonResponse({ error: "Usulan mutasi not found" }, { status: 404 });
    }

    return jsonResponse({ ok: true, row: rows[0] });
  } catch (error) {
    console.error("Error fetching detail usulan mutasi:", error);
    return jsonResponse(
      { error: "Failed to fetch usulan mutasi detail" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureMutasiTable();
    const id = parseId(params.id);
    if (!id) {
      return jsonResponse({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json();
    const sql = `
      UPDATE ${TABLE_NAME}
      SET
        nip = ?,
        nama_pegawai = ?,
        gelar_depan = ?,
        gelar_belakang = ?,
        pangkat_golongan = ?,
        jabatan = ?,
        abk_j_lama = ?,
        bezetting_j_lama = ?,
        nonasn_bezetting_lama = ?,
        nonasn_abk_lama = ?,
        jabatan_baru = ?,
        abk_j_baru = ?,
        bezetting_j_baru = ?,
        nonasn_bezetting_baru = ?,
        nonasn_abk_baru = ?,
        nama_ukpd = ?,
        ukpd_tujuan = ?,
        alasan = ?,
        tanggal_usulan = ?,
        status = ?,
        berkas_path = ?,
        created_by_ukpd = ?,
        keterangan = ?,
        mutasi_id = ?,
        jenis_mutasi = ?,
        verif_checklist = ?
      WHERE id = ?
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
      asNullable(body?.status),
      asNullable(body?.berkas_path),
      asNullable(body?.created_by_ukpd),
      asNullable(body?.keterangan),
      asNullable(body?.mutasi_id),
      asNullable(body?.jenis_mutasi),
      normalizeChecklist(body?.verif_checklist),
      id
    );

    return jsonResponse({ ok: true, message: "Usulan mutasi berhasil diperbarui." });
  } catch (error) {
    console.error("Error updating usulan mutasi:", error);
    return jsonResponse(
      { error: "Failed to update usulan mutasi" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureMutasiTable();
    const id = parseId(params.id);
    if (!id) {
      return jsonResponse({ error: "Invalid id" }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, id);
    return jsonResponse({ ok: true, message: "Usulan mutasi berhasil dihapus." });
  } catch (error) {
    console.error("Error deleting usulan mutasi:", error);
    return jsonResponse(
      { error: "Failed to delete usulan mutasi" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return jsonResponse(null, { status: 200 });
}
