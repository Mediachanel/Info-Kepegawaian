import { prisma } from "@/lib/prisma";

type AnyRow = Record<string, any>;

type PegawaiListParams = {
  limit?: number;
  offset?: number;
  unit?: string;
  wilayah?: string;
  jabatan?: string;
  statusList?: string[];
  search?: string;
};

const columnCache = new Map<string, Set<string>>();

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeUpper = (value: unknown) => normalizeText(value).toUpperCase();

const firstValue = (row: AnyRow | null | undefined, keys: string[]) => {
  if (!row) return null;
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value;
  }
  return null;
};

const firstExistingColumn = (columns: Set<string>, names: string[]) => {
  for (const name of names) {
    if (columns.has(name)) return name;
  }
  return null;
};

const buildTextExpr = (alias: string, columns: Set<string>, candidates: string[], out: string) => {
  const parts = candidates
    .filter((name) => columns.has(name))
    .map((name) => `NULLIF(TRIM(${alias}.${name}), '')`);
  if (!parts.length) return `NULL AS ${out}`;
  return `COALESCE(${parts.join(", ")}) AS ${out}`;
};

const buildValueExpr = (alias: string, columns: Set<string>, candidates: string[], out: string) => {
  const parts = candidates
    .filter((name) => columns.has(name))
    .map((name) => `${alias}.${name}`);
  if (!parts.length) return `NULL AS ${out}`;
  return `COALESCE(${parts.join(", ")}) AS ${out}`;
};

const buildOrderExpr = (columns: Set<string>, candidates: string[]) => {
  const column = firstExistingColumn(columns, candidates);
  return column ? `p.${column}` : "NULL";
};

const parseChildDate = (value: unknown) => {
  const text = normalizeText(value);
  if (!text) return null;
  const time = Date.parse(text);
  if (Number.isNaN(time)) return text;
  return new Date(time).toISOString();
};

const inferJenisJabatan = (row: AnyRow) => {
  const jenis = normalizeUpper(firstValue(row, ["jenis", "jenis_jabatan", "tipe_jabatan"]));
  const eselon = normalizeText(firstValue(row, ["eselon"]));
  if (jenis.includes("STR") || jenis.includes("STRUKTURAL") || eselon) return "STR";
  if (jenis.includes("FUN") || jenis.includes("FUNGSIONAL")) return "FUN";
  return eselon ? "STR" : "FUN";
};

async function getTableColumns(table: string) {
  if (columnCache.has(table)) {
    return columnCache.get(table)!;
  }

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`SHOW COLUMNS FROM ${table}`);
    const columns = new Set(rows.map((row) => row.Field).filter(Boolean));
    columnCache.set(table, columns);
    return columns;
  } catch {
    const empty = new Set<string>();
    columnCache.set(table, empty);
    return empty;
  }
}

async function buildPegawaiBaseSelect() {
  const columns = await getTableColumns("pegawai");
  if (!columns.size) {
    throw new Error("Tabel pegawai tidak ditemukan.");
  }

  const select = [
    buildValueExpr("p", columns, ["id_pegawai", "id"], "id_pegawai"),
    buildTextExpr("p", columns, ["nama", "nama_pegawai"], "nama"),
    buildTextExpr("p", columns, ["nama_pegawai", "nama"], "nama_pegawai"),
    buildTextExpr("p", columns, ["nip"], "nip"),
    buildTextExpr("p", columns, ["nrk"], "nrk"),
    buildTextExpr("p", columns, ["nik"], "nik"),
    buildTextExpr("p", columns, ["ukpd", "nama_ukpd", "ukpd_id"], "nama_ukpd"),
    buildTextExpr("p", columns, ["ukpd_id", "ukpd"], "ukpd_id"),
    buildTextExpr("p", columns, ["wilayah", "wilayah_ukpd"], "wilayah"),
    buildTextExpr("p", columns, ["wilayah_ukpd", "wilayah"], "wilayah_ukpd"),
    buildTextExpr("p", columns, ["jabatan_orb", "nama_jabatan_orb", "jabatan"], "nama_jabatan_orb"),
    buildTextExpr("p", columns, ["nama_jabatan_menpan", "jabatan", "jabatan_orb", "nama_jabatan_orb"], "nama_jabatan_menpan"),
    buildTextExpr("p", columns, ["status_pegawai", "jenis_pegawai", "nama_status_aktif"], "jenis_pegawai"),
    buildTextExpr("p", columns, ["status_pegawai", "nama_status_aktif", "jenis_pegawai"], "status_pegawai"),
    buildTextExpr("p", columns, ["status_rumpun", "nama_status_rumpun"], "status_rumpun"),
    buildTextExpr("p", columns, ["status_rumpun", "nama_status_rumpun"], "nama_status_rumpun"),
    buildTextExpr("p", columns, ["nama_status_aktif", "status_pegawai", "jenis_pegawai", "kondisi"], "nama_status_aktif"),
    buildTextExpr("p", columns, ["kondisi", "nama_status_aktif"], "kondisi"),
    buildTextExpr("p", columns, ["pangkat_golongan", "pangkat"], "pangkat_golongan"),
    buildValueExpr("p", columns, ["tmt_pangkat_terakhir"], "tmt_pangkat_terakhir"),
    buildTextExpr("p", columns, ["jenis_kelamin"], "jenis_kelamin"),
    buildValueExpr("p", columns, ["tmt_kerja_ukpd"], "tmt_kerja_ukpd"),
    buildTextExpr("p", columns, ["tempat_lahir"], "tempat_lahir"),
    buildValueExpr("p", columns, ["tanggal_lahir"], "tanggal_lahir"),
    buildTextExpr("p", columns, ["agama"], "agama"),
    buildTextExpr("p", columns, ["status_perkawinan", "status_pernikahan", "status_nikah"], "status_perkawinan"),
    buildTextExpr("p", columns, ["jenjang_pendidikan", "pendidikan_sk_pangkat"], "jenjang_pendidikan"),
    buildTextExpr("p", columns, ["pendidikan_sk_pangkat", "jenjang_pendidikan"], "pendidikan_sk_pangkat"),
    buildTextExpr("p", columns, ["program_studi", "jurusan_pendidikan"], "program_studi"),
    buildTextExpr("p", columns, ["nama_universitas", "universitas"], "nama_universitas"),
    buildTextExpr("p", columns, ["no_hp_pegawai", "no_tlp"], "no_hp_pegawai"),
    buildTextExpr("p", columns, ["email", "email_aktif_pegawai"], "email"),
    buildTextExpr("p", columns, ["no_bpjs"], "no_bpjs"),
    buildTextExpr("p", columns, ["gelar_depan"], "gelar_depan"),
    buildTextExpr("p", columns, ["gelar_belakang"], "gelar_belakang"),
    buildTextExpr("p", columns, ["alamat_ktp"], "alamat_ktp"),
    buildTextExpr("p", columns, ["alamat_domisili"], "alamat_domisili"),
  ];

  const orderNama = buildOrderExpr(columns, ["nama", "nama_pegawai"]);
  return {
    sql: `SELECT ${select.join(", ")} FROM pegawai p`,
    orderNama,
  };
}

function normalizePegawaiRow(row: AnyRow) {
  return {
    ...row,
    id_pegawai: firstValue(row, ["id_pegawai", "id"]),
    nama: normalizeText(firstValue(row, ["nama", "nama_pegawai"])),
    nama_pegawai: normalizeText(firstValue(row, ["nama_pegawai", "nama"])),
    nip: normalizeText(firstValue(row, ["nip"])),
    nrk: normalizeText(firstValue(row, ["nrk"])),
    nik: normalizeText(firstValue(row, ["nik"])),
    nama_ukpd: normalizeText(firstValue(row, ["nama_ukpd", "ukpd", "ukpd_id"])),
    wilayah: normalizeText(firstValue(row, ["wilayah", "wilayah_ukpd"])),
    wilayah_ukpd: normalizeText(firstValue(row, ["wilayah_ukpd", "wilayah"])),
    nama_jabatan_orb: normalizeText(firstValue(row, ["nama_jabatan_orb", "jabatan"])),
    nama_jabatan_menpan: normalizeText(firstValue(row, ["nama_jabatan_menpan", "jabatan", "nama_jabatan_orb"])),
    jenis_pegawai: normalizeText(firstValue(row, ["jenis_pegawai", "status_pegawai", "nama_status_aktif"])),
    status_pegawai: normalizeText(firstValue(row, ["status_pegawai", "jenis_pegawai", "nama_status_aktif"])),
    status_rumpun: normalizeText(firstValue(row, ["status_rumpun", "nama_status_rumpun"])),
    nama_status_rumpun: normalizeText(firstValue(row, ["nama_status_rumpun", "status_rumpun"])),
    nama_status_aktif: normalizeText(firstValue(row, ["nama_status_aktif", "status_pegawai", "jenis_pegawai", "kondisi"])),
    kondisi: normalizeText(firstValue(row, ["kondisi", "nama_status_aktif"])),
    pangkat_golongan: normalizeText(firstValue(row, ["pangkat_golongan", "pangkat"])),
    tmt_pangkat_terakhir: firstValue(row, ["tmt_pangkat_terakhir"]),
    tmt_kerja_ukpd: firstValue(row, ["tmt_kerja_ukpd"]),
    tanggal_lahir: firstValue(row, ["tanggal_lahir"]),
    tempat_lahir: normalizeText(firstValue(row, ["tempat_lahir"])),
    agama: normalizeText(firstValue(row, ["agama"])),
    status_perkawinan: normalizeText(firstValue(row, ["status_perkawinan", "status_pernikahan", "status_nikah"])),
    jenjang_pendidikan: normalizeText(firstValue(row, ["jenjang_pendidikan", "pendidikan_sk_pangkat"])),
    pendidikan_sk_pangkat: normalizeText(firstValue(row, ["pendidikan_sk_pangkat", "jenjang_pendidikan"])),
    program_studi: normalizeText(firstValue(row, ["program_studi", "jurusan_pendidikan"])),
    nama_universitas: normalizeText(firstValue(row, ["nama_universitas", "universitas"])),
    no_hp_pegawai: normalizeText(firstValue(row, ["no_hp_pegawai", "no_tlp"])),
    email: normalizeText(firstValue(row, ["email", "email_aktif_pegawai"])),
    no_bpjs: normalizeText(firstValue(row, ["no_bpjs"])),
    gelar_depan: normalizeText(firstValue(row, ["gelar_depan"])),
    gelar_belakang: normalizeText(firstValue(row, ["gelar_belakang"])),
    alamat_ktp: normalizeText(firstValue(row, ["alamat_ktp"])),
    alamat_domisili: normalizeText(firstValue(row, ["alamat_domisili"])),
  };
}

async function fetchRowsByIdentity(table: string, pegawai: AnyRow, orderBy?: string) {
  const columns = await getTableColumns(table);
  if (!columns.size) return [];

  const clauses: string[] = [];
  const params: any[] = [];
  const id = normalizeText(pegawai.id_pegawai);
  const nik = normalizeText(pegawai.nik);
  const nip = normalizeText(pegawai.nip);
  const nrk = normalizeText(pegawai.nrk);

  if (id) {
    if (columns.has("id_pegawai")) {
      clauses.push("CAST(id_pegawai AS CHAR) = ?");
      params.push(id);
    }
    if (columns.has("pegawai_id")) {
      clauses.push("CAST(pegawai_id AS CHAR) = ?");
      params.push(id);
    }
  }
  if (nik && columns.has("nik")) {
    clauses.push("nik = ?");
    params.push(nik);
  }
  if (nip && columns.has("nip")) {
    clauses.push("nip = ?");
    params.push(nip);
  }
  if (nrk && columns.has("nrk")) {
    clauses.push("nrk = ?");
    params.push(nrk);
  }

  if (!clauses.length) return [];
  const orderClause = orderBy ? ` ORDER BY ${orderBy}` : "";
  return prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM ${table} WHERE ${clauses.join(" OR ")}${orderClause}`,
    ...params
  );
}

function normalizeAlamatRows(rows: AnyRow[], pegawai: AnyRow) {
  const mapped = rows
    .map((row, index) => ({
      tipe: normalizeText(firstValue(row, ["tipe"])) || (index === 0 ? "DOMISILI" : "Alamat"),
      jalan: normalizeText(firstValue(row, ["jalan", "alamat_jalan", "alamat"])),
      kelurahan: normalizeText(firstValue(row, ["kelurahan", "alamat_kelurahan"])),
      kecamatan: normalizeText(firstValue(row, ["kecamatan", "alamat_kecamatan"])),
      kota_kabupaten: normalizeText(firstValue(row, ["kota_kabupaten", "kota", "alamat_kota"])),
      provinsi: normalizeText(firstValue(row, ["provinsi", "alamat_provinsi"])),
    }))
    .filter((row) => Object.values(row).some((value) => normalizeText(value)));

  if (mapped.length) return mapped;

  const fallback: AnyRow[] = [];
  if (normalizeText(pegawai.alamat_domisili)) {
    fallback.push({
      tipe: "DOMISILI",
      jalan: normalizeText(pegawai.alamat_domisili),
      kelurahan: "",
      kecamatan: "",
      kota_kabupaten: "",
      provinsi: "",
    });
  }
  if (normalizeText(pegawai.alamat_ktp) && normalizeText(pegawai.alamat_ktp) !== normalizeText(pegawai.alamat_domisili)) {
    fallback.push({
      tipe: "KTP",
      jalan: normalizeText(pegawai.alamat_ktp),
      kelurahan: "",
      kecamatan: "",
      kota_kabupaten: "",
      provinsi: "",
    });
  }
  return fallback;
}

function normalizeKeluargaRows(rows: AnyRow[]) {
  let pasangan: AnyRow | null = null;
  const anak: AnyRow[] = [];

  for (const row of rows) {
    const hubungan = normalizeUpper(firstValue(row, ["hubungan", "status_hubungan"]));
    const nama = normalizeText(firstValue(row, ["nama_keluarga", "nama"]));
    if (!hubungan || !nama) continue;

    const payload = {
      nama,
      tempat_lahir: normalizeText(firstValue(row, ["tempat_lahir_keluarga", "tempat_lahir"])),
      tanggal_lahir: parseChildDate(firstValue(row, ["tanggal_lahir_keluarga", "tanggal_lahir"])),
      jenis_kelamin: normalizeText(firstValue(row, ["jenis_kelamin_keluarga", "jenis_kelamin"])),
      pekerjaan: normalizeText(firstValue(row, ["pekerjaan"])),
      tunjangan: firstValue(row, ["tunjangan"]) ?? 0,
      no_tlp: normalizeText(firstValue(row, ["no_tlp", "telepon"])),
      email: normalizeText(firstValue(row, ["email"])),
    };

    if (hubungan.includes("SUAMI") || hubungan.includes("ISTRI") || hubungan.includes("ISTERI")) {
      pasangan = {
        status_punya: "YA",
        ...payload,
      };
      continue;
    }

    if (hubungan.includes("ANAK")) {
      const match = hubungan.match(/ANAK\s*(\d+)/i);
      anak.push({
        urutan: match ? Number(match[1]) : anak.length + 1,
        nama: payload.nama,
        jenis_kelamin: payload.jenis_kelamin,
        tempat_lahir: payload.tempat_lahir,
        tanggal_lahir: payload.tanggal_lahir,
        pekerjaan: payload.pekerjaan,
      });
    }
  }

  anak.sort((a, b) => Number(a.urutan || 0) - Number(b.urutan || 0));
  return { pasangan, anak };
}

function normalizePendidikanFormalRows(rows: AnyRow[]) {
  return rows.map((row) => ({
    tingkat: normalizeText(firstValue(row, ["tingkat", "jenjang"])),
    jurusan: normalizeText(firstValue(row, ["jurusan", "program_studi"])),
    tanggal_ijazah: parseChildDate(firstValue(row, ["tanggal_ijazah", "tgl_ijazah"])),
    nama_sekolah: normalizeText(firstValue(row, ["nama_sekolah", "sekolah", "nama_universitas"])),
    kota: normalizeText(firstValue(row, ["kota"])),
  }));
}

function normalizePendidikanNonformalRows(rows: AnyRow[]) {
  return rows.map((row) => ({
    nama_pelatihan: normalizeText(firstValue(row, ["nama_pelatihan", "nama_sekolah", "nama_diklat"])),
    tanggal_ijazah: parseChildDate(firstValue(row, ["tanggal_ijazah", "tgl_ijazah"])),
    penyelenggara: normalizeText(firstValue(row, ["penyelenggara"])),
    kota: normalizeText(firstValue(row, ["kota"])),
  }));
}

function normalizePangkatRows(rows: AnyRow[]) {
  return rows.map((row) => ({
    tmt: parseChildDate(firstValue(row, ["tmt"])),
    pangkat: normalizeText(firstValue(row, ["pangkat"])),
    lokasi: normalizeText(firstValue(row, ["lokasi"])),
    no_sk: normalizeText(firstValue(row, ["no_sk"])),
    tanggal_sk: parseChildDate(firstValue(row, ["tanggal_sk", "tgl_sk"])),
  }));
}

function normalizeJabatanRows(rows: AnyRow[]) {
  const jabatan_fungsional: AnyRow[] = [];
  const jabatan_struktural: AnyRow[] = [];

  for (const row of rows) {
    const payload = {
      tmt: parseChildDate(firstValue(row, ["tmt"])),
      lokasi: normalizeText(firstValue(row, ["lokasi"])),
      jabatan: normalizeText(firstValue(row, ["jabatan"])),
      pangkat: normalizeText(firstValue(row, ["pangkat"])),
      eselon: normalizeText(firstValue(row, ["eselon"])),
      no_sk: normalizeText(firstValue(row, ["no_sk"])),
      tanggal_sk: parseChildDate(firstValue(row, ["tanggal_sk", "tgl_sk"])),
    };

    if (inferJenisJabatan(row) === "STR") {
      jabatan_struktural.push(payload);
    } else {
      jabatan_fungsional.push(payload);
    }
  }

  return { jabatan_fungsional, jabatan_struktural };
}

function normalizeGajiRows(rows: AnyRow[]) {
  return rows.map((row) => ({
    tmt: parseChildDate(firstValue(row, ["tmt"])),
    pangkat: normalizeText(firstValue(row, ["pangkat"])),
    gaji: firstValue(row, ["gaji"]),
    no_sk: normalizeText(firstValue(row, ["no_sk"])),
    tanggal_sk: parseChildDate(firstValue(row, ["tanggal_sk", "tgl_sk"])),
  }));
}

function normalizeHukumanRows(rows: AnyRow[]) {
  return rows.map((row) => ({
    tanggal_mulai: parseChildDate(firstValue(row, ["tanggal_mulai", "tmt_mulai"])),
    tanggal_akhir: parseChildDate(firstValue(row, ["tanggal_akhir", "tmt_akhir"])),
    jenis_hukuman: normalizeText(firstValue(row, ["jenis_hukuman", "hukuman"])),
    no_sk: normalizeText(firstValue(row, ["no_sk"])),
    tanggal_sk: parseChildDate(firstValue(row, ["tanggal_sk", "tgl_sk"])),
    keterangan: normalizeText(firstValue(row, ["keterangan"])),
  }));
}

function normalizePenghargaanRows(rows: AnyRow[]) {
  return rows.map((row) => ({
    nama_penghargaan: normalizeText(firstValue(row, ["nama_penghargaan", "penghargaan"])),
    asal_penghargaan: normalizeText(firstValue(row, ["asal_penghargaan", "asal"])),
    no_sk: normalizeText(firstValue(row, ["no_sk"])),
    tanggal_sk: parseChildDate(firstValue(row, ["tanggal_sk", "tgl_sk"])),
  }));
}

function normalizeSkpRows(rows: AnyRow[]) {
  return rows.map((row) => ({
    tahun: firstValue(row, ["tahun"]),
    nilai_skp: firstValue(row, ["nilai_skp"]),
    nilai_perilaku: firstValue(row, ["nilai_perilaku"]),
    nilai_prestasi: firstValue(row, ["nilai_prestasi", "nilai_total"]),
    keterangan: normalizeText(firstValue(row, ["keterangan"])),
  }));
}

export async function fetchLegacyPegawaiList(params: PegawaiListParams) {
  const { sql } = await buildPegawaiBaseSelect();
  const where: string[] = [];
  const queryParams: any[] = [];

  if (normalizeText(params.unit)) {
    where.push("UPPER(TRIM(COALESCE(x.nama_ukpd, ''))) = ?");
    queryParams.push(normalizeUpper(params.unit));
  }
  if (normalizeText(params.wilayah)) {
    where.push("UPPER(TRIM(COALESCE(x.wilayah, x.wilayah_ukpd, ''))) = ?");
    queryParams.push(normalizeUpper(params.wilayah));
  }
  if (normalizeText(params.jabatan)) {
    where.push("UPPER(TRIM(COALESCE(x.nama_jabatan_orb, ''))) LIKE ?");
    queryParams.push(`%${normalizeUpper(params.jabatan)}%`);
  }
  if (params.statusList && params.statusList.length > 0) {
    const cleaned = params.statusList.map((item) => normalizeUpper(item)).filter(Boolean);
    if (cleaned.length) {
      where.push(`UPPER(TRIM(COALESCE(x.jenis_pegawai, x.status_pegawai, ''))) IN (${cleaned.map(() => "?").join(",")})`);
      queryParams.push(...cleaned);
    }
  }
  if (normalizeText(params.search)) {
    const search = `%${normalizeUpper(params.search)}%`;
    where.push(`(
      UPPER(TRIM(COALESCE(x.nama, ''))) LIKE ? OR
      UPPER(TRIM(COALESCE(x.nama_pegawai, ''))) LIKE ? OR
      UPPER(TRIM(COALESCE(x.nip, ''))) LIKE ? OR
      UPPER(TRIM(COALESCE(x.nrk, ''))) LIKE ? OR
      UPPER(TRIM(COALESCE(x.nik, ''))) LIKE ?
    )`);
    queryParams.push(search, search, search, search, search);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*) AS total FROM (${sql}) x ${whereClause}`,
    ...queryParams
  );
  const total = Number(firstValue(totalRows?.[0], ["total"]) || 0);

  const limit = params.limit && params.limit > 0 ? params.limit : 1000;
  const offset = params.offset && params.offset > 0 ? params.offset : 0;
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM (${sql}) x ${whereClause} ORDER BY COALESCE(x.nama, x.nama_pegawai) ASC LIMIT ? OFFSET ?`,
    ...queryParams,
    limit,
    offset
  );

  return {
    total,
    rows: rows.map((row) => normalizePegawaiRow(row)),
  };
}

async function fetchLegacyPegawaiSingle(whereClause: string, ...params: any[]) {
  const { sql } = await buildPegawaiBaseSelect();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM (${sql}) x WHERE ${whereClause} LIMIT 1`,
    ...params
  );
  const pegawai = rows.length ? normalizePegawaiRow(rows[0]) : null;
  if (!pegawai) return null;

  const [alamatRows, keluargaRows, pangkatRows, jabatanRows, gajiRows, hukumanRows, penghargaanRows, skpRows, pendidikanFormalRows, pendidikanNonformalRows] =
    await Promise.all([
      fetchRowsByIdentity("alamat", pegawai, "id DESC"),
      fetchRowsByIdentity("keluarga", pegawai, "id ASC"),
      fetchRowsByIdentity("riwayat_pangkat", pegawai, "COALESCE(tmt, tanggal_sk, tgl_sk, '1900-01-01') DESC"),
      fetchRowsByIdentity("riwayat_jabatan", pegawai, "COALESCE(tmt, tanggal_sk, tgl_sk, '1900-01-01') DESC"),
      fetchRowsByIdentity("riwayat_gaji_pokok", pegawai, "COALESCE(tmt, tanggal_sk, tgl_sk, '1900-01-01') DESC"),
      fetchRowsByIdentity("hukuman_disiplin", pegawai, "COALESCE(tanggal_mulai, tanggal_sk, tgl_sk, '1900-01-01') DESC"),
      fetchRowsByIdentity("penghargaan", pegawai, "COALESCE(tanggal_sk, tgl_sk, '1900-01-01') DESC"),
      fetchRowsByIdentity("riwayat_skp", pegawai, "COALESCE(tahun, 0) DESC"),
      fetchRowsByIdentity("pendidikan_formal", pegawai, "COALESCE(tanggal_ijazah, tgl_ijazah, '1900-01-01') DESC"),
      fetchRowsByIdentity("pendidikan_nonformal", pegawai, "COALESCE(tanggal_ijazah, tgl_ijazah, '1900-01-01') DESC"),
    ]);

  const keluarga = normalizeKeluargaRows(keluargaRows);
  const jabatan = normalizeJabatanRows(jabatanRows);

  return {
    ...pegawai,
    alamat: normalizeAlamatRows(alamatRows, pegawai),
    pasangan: keluarga.pasangan,
    anak: keluarga.anak,
    gaji_pokok: normalizeGajiRows(gajiRows),
    hukuman_disiplin: normalizeHukumanRows(hukumanRows),
    jabatan_fungsional: jabatan.jabatan_fungsional,
    jabatan_struktural: jabatan.jabatan_struktural,
    pangkat: normalizePangkatRows(pangkatRows),
    pendidikan_formal: normalizePendidikanFormalRows(pendidikanFormalRows),
    pendidikan_nonformal: normalizePendidikanNonformalRows(pendidikanNonformalRows),
    penghargaan: normalizePenghargaanRows(penghargaanRows),
    skp: normalizeSkpRows(skpRows),
  };
}

export async function fetchLegacyPegawaiById(id: string) {
  const text = normalizeText(id);
  if (!text) return null;
  return fetchLegacyPegawaiSingle("CAST(x.id_pegawai AS CHAR) = ? OR x.nik = ?", text, text);
}

export async function fetchLegacyPegawaiByNik(nik: string) {
  const text = normalizeText(nik);
  if (!text) return null;
  return fetchLegacyPegawaiSingle("x.nik = ?", text);
}

export async function fetchLegacyPegawaiFilters() {
  const { sql } = await buildPegawaiBaseSelect();
  const [jabatanRows, statusRows] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(
      `SELECT DISTINCT x.nama_jabatan_orb FROM (${sql}) x WHERE x.nama_jabatan_orb IS NOT NULL AND TRIM(x.nama_jabatan_orb) <> '' ORDER BY x.nama_jabatan_orb ASC`
    ),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT DISTINCT x.jenis_pegawai FROM (${sql}) x WHERE x.jenis_pegawai IS NOT NULL AND TRIM(x.jenis_pegawai) <> '' ORDER BY x.jenis_pegawai ASC`
    ),
  ]);

  return {
    jabatan: jabatanRows.map((row) => normalizeText(row.nama_jabatan_orb)).filter(Boolean),
    status: statusRows.map((row) => normalizeText(row.jenis_pegawai)).filter(Boolean),
  };
}
