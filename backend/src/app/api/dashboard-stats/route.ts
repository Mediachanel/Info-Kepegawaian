import { NextRequest, NextResponse } from "next/server";
import { jsonSafe } from "@/lib/json";
import { fetchLegacyPegawaiList } from "../pegawai/_legacy";

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeUpper = (value: unknown) => normalizeText(value).toUpperCase();

const inferStatus = (row: Record<string, any>) => {
  const text = normalizeUpper(
    row.status_pegawai || row.jenis_pegawai || row.nama_status_aktif || row.status_rumpun
  );
  if (text === "PNS") return "PNS";
  if (text === "CPNS") return "CPNS";
  if (text.includes("PPPK") || text.includes("P3K")) return "PPPK";
  if (text.includes("NON ASN") || text.includes("NON PNS") || text.includes("PROFESIONAL")) {
    return "NON PNS";
  }
  if (text.includes("PJLP")) return "PJLP";
  return normalizeText(row.status_pegawai || row.jenis_pegawai || row.nama_status_aktif || row.status_rumpun);
};

const countBy = (rows: Record<string, any>[], keyFn: (row: Record<string, any>) => string) => {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = normalizeText(keyFn(row));
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
};

const pushCounterRows = (
  target: Array<Record<string, any>>,
  labelKey: "unit" | "rumpun" | "pendidikan",
  valueKey: "status" | "gender" | "marital",
  rows: Record<string, any>[],
  labelFn: (row: Record<string, any>) => string,
  valueFn: (row: Record<string, any>) => string
) => {
  const map = new Map<string, number>();
  for (const row of rows) {
    const label = normalizeText(labelFn(row));
    const value = normalizeText(valueFn(row));
    const wilayah = normalizeText(row.wilayah || row.wilayah_ukpd);
    if (!label || !value) continue;
    const composite = `${label}|||${value}|||${wilayah}`;
    map.set(composite, (map.get(composite) || 0) + 1);
  }

  map.forEach((count, composite) => {
    const [label, value, wilayah] = composite.split("|||");
    target.push({
      [labelKey]: label,
      [valueKey]: value,
      wilayah,
      count,
    });
  });
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unit = (searchParams.get("unit") || "").trim();
    const wilayah = (searchParams.get("wilayah") || "").trim();
    const pegawai = (
      await fetchLegacyPegawaiList({
        limit: 50000,
        offset: 0,
        unit,
        wilayah,
      })
    ).rows.filter((row) => {
      const kondisi = normalizeUpper(row.kondisi);
      return kondisi === "AKTIF" || kondisi === "TUGAS BELAJAR";
    });

    const total = pegawai.length;
    const statusCounts = Array.from(countBy(pegawai, (row) => inferStatus(row)).entries()).map(([status, count]) => ({ status, count }));
    const genderCounts = Array.from(countBy(pegawai, (row) => row.jenis_kelamin).entries()).map(([gender, count]) => ({ gender, count }));
    const maritalCounts = Array.from(countBy(pegawai, (row) => row.status_perkawinan).entries()).map(([marital, count]) => ({ marital, count }));

    const unitStatus: Array<Record<string, any>> = [];
    const unitGender: Array<Record<string, any>> = [];
    const unitMarital: Array<Record<string, any>> = [];
    const rumpunStatus: Array<Record<string, any>> = [];
    const rumpunGender: Array<Record<string, any>> = [];
    const rumpunMarital: Array<Record<string, any>> = [];
    const pendidikanStatus: Array<Record<string, any>> = [];
    const pendidikanGender: Array<Record<string, any>> = [];
    const pendidikanMarital: Array<Record<string, any>> = [];

    pushCounterRows(unitStatus, "unit", "status", pegawai, (row) => row.nama_ukpd, (row) => inferStatus(row));
    pushCounterRows(unitGender, "unit", "gender", pegawai, (row) => row.nama_ukpd, (row) => row.jenis_kelamin);
    pushCounterRows(unitMarital, "unit", "marital", pegawai, (row) => row.nama_ukpd, (row) => row.status_perkawinan);
    pushCounterRows(rumpunStatus, "rumpun", "status", pegawai, (row) => row.status_rumpun || row.nama_status_rumpun, (row) => inferStatus(row));
    pushCounterRows(rumpunGender, "rumpun", "gender", pegawai, (row) => row.status_rumpun || row.nama_status_rumpun, (row) => row.jenis_kelamin);
    pushCounterRows(rumpunMarital, "rumpun", "marital", pegawai, (row) => row.status_rumpun || row.nama_status_rumpun, (row) => row.status_perkawinan);
    pushCounterRows(
      pendidikanStatus,
      "pendidikan",
      "status",
      pegawai,
      (row) => row.pendidikan_sk_pangkat || row.jenjang_pendidikan || "(Tidak Tercatat)",
      (row) => inferStatus(row)
    );
    pushCounterRows(
      pendidikanGender,
      "pendidikan",
      "gender",
      pegawai,
      (row) => row.pendidikan_sk_pangkat || row.jenjang_pendidikan || "(Tidak Tercatat)",
      (row) => row.jenis_kelamin
    );
    pushCounterRows(
      pendidikanMarital,
      "pendidikan",
      "marital",
      pegawai,
      (row) => row.pendidikan_sk_pangkat || row.jenjang_pendidikan || "(Tidak Tercatat)",
      (row) => row.status_perkawinan
    );

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
