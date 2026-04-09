import { NextRequest, NextResponse } from "next/server";
import { jsonSafe } from "@/lib/json";
import { fetchLegacyPegawaiByNik } from "../../_legacy";

export async function GET(
  _request: NextRequest,
  { params }: { params: { nik: string } }
) {
  try {
    const nik = String(params.nik || "").trim();
    if (!nik) {
      return NextResponse.json({ error: "NIK is required" }, { status: 400 });
    }

    const pegawai = await fetchLegacyPegawaiByNik(nik);
    if (!pegawai) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(jsonSafe(pegawai));
  } catch (error) {
    console.error("Error fetching pegawai by nik:", error);
    return NextResponse.json(
      { error: "Failed to fetch pegawai by nik" },
      { status: 500 }
    );
  }
}
