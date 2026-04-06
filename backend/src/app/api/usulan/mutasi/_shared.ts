import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const TABLE_NAME = "usulan_mutasi";

export const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
    id INT(11) NOT NULL AUTO_INCREMENT,
    nip VARCHAR(32) NOT NULL,
    nama_pegawai VARCHAR(200) NOT NULL,
    gelar_depan VARCHAR(50) NULL,
    gelar_belakang VARCHAR(50) NULL,
    pangkat_golongan VARCHAR(200) NULL,
    jabatan VARCHAR(200) NULL,
    abk_j_lama SMALLINT UNSIGNED NULL,
    bezetting_j_lama SMALLINT UNSIGNED NULL,
    nonasn_bezetting_lama SMALLINT UNSIGNED NULL,
    nonasn_abk_lama SMALLINT UNSIGNED NULL,
    jabatan_baru VARCHAR(200) NULL,
    abk_j_baru SMALLINT UNSIGNED NULL,
    bezetting_j_baru SMALLINT UNSIGNED NULL,
    nonasn_bezetting_baru SMALLINT UNSIGNED NULL,
    nonasn_abk_baru SMALLINT UNSIGNED NULL,
    nama_ukpd VARCHAR(200) NULL,
    ukpd_tujuan VARCHAR(200) NULL,
    alasan TEXT NOT NULL,
    tanggal_usulan DATETIME NULL,
    status VARCHAR(50) NULL,
    berkas_path VARCHAR(500) NULL,
    created_by_ukpd VARCHAR(200) NULL,
    created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    keterangan TEXT NULL,
    mutasi_id INT(11) NULL,
    jenis_mutasi VARCHAR(100) NULL,
    verif_checklist LONGTEXT NULL,
    PRIMARY KEY (id),
    INDEX idx_nip (nip),
    INDEX idx_nama_ukpd (nama_ukpd),
    INDEX idx_ukpd_tujuan (ukpd_tujuan),
    INDEX idx_status (status),
    INDEX idx_created_by_ukpd (created_by_ukpd),
    INDEX idx_created_at (created_at),
    INDEX idx_mutasi_id (mutasi_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
`;

export const ensureMutasiTable = async () => {
  await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);
};

export const asNullable = (value: unknown) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
};

export const asSmallInt = (value: unknown) => {
  const normalized = asNullable(value);
  if (normalized === null) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};

export const normalizeChecklist = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;
  return typeof value === "string" ? value : JSON.stringify(value);
};

export const jsonResponse = (body: unknown, init?: ResponseInit) => {
  const response = NextResponse.json(body, init);
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
};
