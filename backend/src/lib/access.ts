export type AuthUser = {
  id_ukpd: string;      // BigInt serialized
  nama_ukpd: string;
  role: string;
  wilayah: string | null;
};

export function buildPegawaiWhere(user: AuthUser, queryNamaUkpd?: string, q?: string) {
  const role = (user.role || "").toLowerCase();

  const where: any = {};
  if (q) where.nama = { contains: q };

  if (role.includes("super")) {
    if (queryNamaUkpd) where.nama_ukpd = queryNamaUkpd;
    return where;
  }

  if (role.includes("wilayah")) {
    // filter by wilayah -> ambil daftar nama_ukpd yang wilayah sama (di route kita join/lookup)
    // di sini dikembalikan null marker, route yang handle
    (where as any).__wilayah = user.wilayah;
    if (queryNamaUkpd) where.nama_ukpd = queryNamaUkpd;
    return where;
  }

  // admin ukpd: hanya UKPD sendiri
  where.nama_ukpd = user.nama_ukpd;
  return where;
}
