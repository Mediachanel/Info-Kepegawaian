import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/json";

export async function GET(request: NextRequest) {
  try {
    const rows = await prisma.ukpd.findMany({
      select: { id_ukpd: true, nama_ukpd: true, wilayah: true },
      orderBy: { nama_ukpd: "asc" },
    });

    return NextResponse.json(jsonSafe(rows));
  } catch (error) {
    console.error('Error fetching ukpd:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ukpd' },
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
