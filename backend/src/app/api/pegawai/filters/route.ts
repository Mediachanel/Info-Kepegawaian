import { NextRequest, NextResponse } from "next/server";
import { jsonSafe } from "@/lib/json";
import { fetchLegacyPegawaiFilters } from "../_legacy";

export async function GET(_request: NextRequest) {
  try {
    const { jabatan, status } = await fetchLegacyPegawaiFilters();

    return NextResponse.json(jsonSafe({ jabatan, status }));
  } catch (error) {
    console.error("Error fetching pegawai filters:", error);
    return NextResponse.json(
      { error: "Failed to fetch pegawai filters" },
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
