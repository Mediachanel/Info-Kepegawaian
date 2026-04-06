import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/json";

export async function GET(_request: NextRequest) {
  try {
    const jabatanRows = await prisma.pegawai_master.findMany({
      select: { nama_jabatan_orb: true },
      distinct: ["nama_jabatan_orb"],
    });
    const statusRows = await prisma.pegawai_master.findMany({
      select: { jenis_pegawai: true },
      distinct: ["jenis_pegawai"],
    });

    const jabatan = jabatanRows
      .map((row) => row.nama_jabatan_orb)
      .filter(Boolean)
      .sort();
    const status = statusRows
      .map((row) => row.jenis_pegawai)
      .filter(Boolean)
      .sort();

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
