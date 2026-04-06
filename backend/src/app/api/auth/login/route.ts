import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { nama_ukpd, password } = await request.json();

    const user = await prisma.ukpd.findUnique({
      where: { nama_ukpd: String(nama_ukpd || "").trim() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User tidak ditemukan" },
        { status: 401 }
      );
    }

    // Simple password check
    if (password !== user.password) {
      return NextResponse.json(
        { error: "Password salah" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      user: {
        id_ukpd: user.id_ukpd.toString(),
        nama_ukpd: user.nama_ukpd,
        role: user.role,
        wilayah: user.wilayah,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login gagal' },
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
