import { createHash } from "crypto";
import { ROLES } from "@/lib/constants/roles";
import { getConnectedPool } from "@/lib/db/mysql";

const TABLES = {
  ukpd: "`sisdmk2`.`ukpd`",
  pegawai: "`sisdmk2`.`pegawai`",
  alamat: "`si_data`.`alamat`",
  pasangan: "`si_data`.`pasangan`",
  anak: "`si_data`.`anak`",
  riwayatJabatan: "`si_data`.`riwayat_jabatan`",
  riwayatPangkat: "`si_data`.`riwayat_pangkat`",
  riwayatPendidikan: "`si_data`.`riwayat_pendidikan`"
};

const PEGAWAI_COLUMNS = [
  "id_pegawai",
  "nama",
  "jenis_kelamin",
  "tempat_lahir",
  "tanggal_lahir",
  "nik",
  "agama",
  "nama_ukpd",
  "jenis_ukpd",
  "wilayah",
  "jenis_pegawai",
  "status_rumpun",
  "jenis_kontrak",
  "nrk",
  "nip",
  "nama_jabatan_orb",
  "nama_jabatan_menpan",
  "struktur_atasan_langsung",
  "pangkat_golongan",
  "tmt_pangkat_terakhir",
  "jenjang_pendidikan",
  "program_studi",
  "nama_universitas",
  "no_hp_pegawai",
  "email",
  "no_bpjs",
  "kondisi",
  "status_perkawinan",
  "gelar_depan",
  "gelar_belakang",
  "tmt_kerja_ukpd",
  "created_at",
  "id_ukpd",
  "ukpd_id",
  "jenjang_pendidikan_raw",
  "status_rumpun_raw",
  "nama_jabatan_menpan_raw",
  "jenis_kelamin_raw"
];

const PEGAWAI_MUTABLE_COLUMNS = PEGAWAI_COLUMNS.filter((column) => column !== "id_pegawai");

function toDateString(value) {
  if (!value || typeof value !== "object" || !("toISOString" in value)) return value;
  return value.toISOString().slice(0, 10);
}

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, toDateString(value)]));
}

function normalizeUkpd(row) {
  return {
    ...normalizeRow(row),
    role: row.role || ROLES.ADMIN_UKPD
  };
}

function normalizeText(value) {
  return String(value || "").trim();
}

function nullableText(value) {
  const text = normalizeText(value);
  return text || null;
}

function nullableDateText(value) {
  const text = normalizeText(value);
  return text || null;
}

function buildAlamatLengkap(row) {
  const jalan = normalizeText(row.jalan);
  const jalanLower = jalan.toLowerCase();
  const tail = [row.kelurahan, row.kecamatan, row.kota_kabupaten, row.provinsi]
    .map(normalizeText)
    .filter(Boolean)
    .filter((part, index, all) => all.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index)
    .filter((part) => !jalanLower || !jalanLower.includes(part.toLowerCase()));

  return [jalan, ...tail].filter(Boolean).join(", ");
}

async function queryRows(sql, params = []) {
  const pool = await getConnectedPool();
  const [rows] = await pool.query(sql, params);
  return rows.map(normalizeRow);
}

async function getNextNumericId(pool, tableName, column = "id") {
  const [[row]] = await pool.query(`SELECT COALESCE(MAX(\`${column}\`), 0) + 1 AS next_id FROM ${tableName}`);
  return Number(row?.next_id || 1);
}

function makeSourceKey(prefix, idPegawai, index, values = []) {
  return createHash("md5").update([prefix, idPegawai, index, ...values.map((value) => normalizeText(value))].join("|")).digest("hex");
}

function buildRiwayatJabatanRecord(item, pegawai, index) {
  return {
    id_pegawai: Number(pegawai.id_pegawai),
    nip: nullableText(pegawai.nip),
    nama_pegawai: nullableText(pegawai.nama),
    gelar_depan: nullableText(pegawai.gelar_depan),
    gelar_belakang: nullableText(pegawai.gelar_belakang),
    nama_jabatan_orb: nullableText(item.nama_jabatan_orb),
    nama_jabatan_menpan: nullableText(item.nama_jabatan_menpan),
    struktur_atasan_langsung: nullableText(item.struktur_atasan_langsung),
    nama_ukpd: nullableText(pegawai.nama_ukpd),
    wilayah: nullableText(pegawai.wilayah),
    jenis_pegawai: nullableText(pegawai.jenis_pegawai),
    status_rumpun: nullableText(item.status_rumpun || pegawai.status_rumpun),
    tmt_jabatan: nullableDateText(item.tmt_jabatan),
    nomor_sk: nullableText(item.nomor_sk),
    tanggal_sk: nullableDateText(item.tanggal_sk),
    keterangan: nullableText(item.keterangan),
    sumber: "app_form",
    source_key: makeSourceKey("riwayat_jabatan", pegawai.id_pegawai, index, [
      item.nama_jabatan_orb,
      item.nama_jabatan_menpan,
      item.tmt_jabatan,
      item.nomor_sk
    ])
  };
}

function buildRiwayatPangkatRecord(item, pegawai, index) {
  return {
    id_pegawai: Number(pegawai.id_pegawai),
    nip: nullableText(pegawai.nip),
    nama_pegawai: nullableText(pegawai.nama),
    pangkat_golongan: nullableText(item.pangkat_golongan),
    tmt_pangkat: nullableDateText(item.tmt_pangkat),
    nomor_sk: nullableText(item.nomor_sk),
    tanggal_sk: nullableDateText(item.tanggal_sk),
    keterangan: nullableText(item.keterangan),
    sumber: "app_form",
    source_key: makeSourceKey("riwayat_pangkat", pegawai.id_pegawai, index, [
      item.pangkat_golongan,
      item.tmt_pangkat,
      item.nomor_sk
    ])
  };
}

function isAlamatFilled(item) {
  return ["jalan", "kelurahan", "kecamatan", "kota_kabupaten", "provinsi"].some((key) => normalizeText(item?.[key]));
}

function isPasanganFilled(item) {
  return normalizeText(item?.status_punya).toLowerCase() === "ya"
    || ["nama", "no_tlp", "email", "pekerjaan"].some((key) => normalizeText(item?.[key]));
}

function isAnakFilled(item) {
  return ["nama", "jenis_kelamin", "tempat_lahir", "tanggal_lahir", "pekerjaan"].some((key) => normalizeText(item?.[key]));
}

function isRiwayatJabatanFilled(item) {
  return ["nama_jabatan_orb", "nama_jabatan_menpan", "struktur_atasan_langsung", "tmt_jabatan", "nomor_sk", "tanggal_sk", "keterangan"].some((key) => normalizeText(item?.[key]));
}

function isRiwayatPangkatFilled(item) {
  return ["pangkat_golongan", "tmt_pangkat", "nomor_sk", "tanggal_sk", "keterangan"].some((key) => normalizeText(item?.[key]));
}

export async function getUkpdData() {
  const rows = await queryRows(`SELECT * FROM ${TABLES.ukpd} ORDER BY \`nama_ukpd\` ASC`);
  return rows.map(normalizeUkpd);
}

export async function getPegawaiData() {
  return queryRows(`SELECT * FROM ${TABLES.pegawai} ORDER BY \`id_pegawai\` DESC`);
}

export async function getPegawaiAlamat(id) {
  const rows = await queryRows(
    `SELECT * FROM ${TABLES.alamat}
     WHERE \`id_pegawai\` = ?
     ORDER BY CASE
       WHEN LOWER(\`tipe\`) = 'ktp' THEN 0
       WHEN LOWER(\`tipe\`) = 'domisili' THEN 1
       ELSE 2
     END, \`id\` ASC`,
    [Number(id)]
  );

  return rows.map((row) => ({
    ...row,
    alamat_lengkap: buildAlamatLengkap(row)
  }));
}

export async function getPegawaiPasangan(id) {
  return queryRows(`SELECT * FROM ${TABLES.pasangan} WHERE \`id_pegawai\` = ? ORDER BY \`id\` ASC`, [Number(id)]);
}

export async function getPegawaiAnak(id) {
  return queryRows(`SELECT * FROM ${TABLES.anak} WHERE \`id_pegawai\` = ? ORDER BY \`urutan\` ASC, \`id\` ASC`, [Number(id)]);
}

export async function getPegawaiRiwayatJabatan(id) {
  return queryRows(
    `SELECT * FROM ${TABLES.riwayatJabatan}
     WHERE \`id_pegawai\` = ?
     ORDER BY COALESCE(NULLIF(\`tmt_jabatan\`, ''), '9999-12-31') DESC, \`id\` DESC`,
    [Number(id)]
  );
}

export async function getPegawaiRiwayatPangkat(id) {
  return queryRows(
    `SELECT * FROM ${TABLES.riwayatPangkat}
     WHERE \`id_pegawai\` = ?
     ORDER BY COALESCE(NULLIF(\`tmt_pangkat\`, ''), '9999-12-31') DESC, \`id\` DESC`,
    [Number(id)]
  );
}

export async function getPegawaiRiwayatPendidikan(id) {
  return queryRows(
    `SELECT * FROM ${TABLES.riwayatPendidikan}
     WHERE \`id_pegawai\` = ?
     ORDER BY \`id\` DESC`,
    [Number(id)]
  );
}

export async function getPegawaiDetailData(id) {
  const [alamat, pasangan, anak, riwayatJabatan, riwayatPangkat, riwayatPendidikan] = await Promise.all([
    getPegawaiAlamat(id),
    getPegawaiPasangan(id),
    getPegawaiAnak(id),
    getPegawaiRiwayatJabatan(id),
    getPegawaiRiwayatPangkat(id),
    getPegawaiRiwayatPendidikan(id)
  ]);

  return {
    alamat,
    pasangan,
    anak,
    riwayat_jabatan: riwayatJabatan,
    riwayat_pangkat: riwayatPangkat,
    riwayat_pendidikan: riwayatPendidikan
  };
}

async function replaceAlamatRows(pool, idPegawai, alamatRows = []) {
  await pool.query(`DELETE FROM ${TABLES.alamat} WHERE \`id_pegawai\` = ?`, [Number(idPegawai)]);
  const filtered = alamatRows.filter(isAlamatFilled);
  if (!filtered.length) return;

  let nextId = await getNextNumericId(pool, TABLES.alamat);
  for (const row of filtered) {
    const record = {
      id: nextId++,
      id_pegawai: Number(idPegawai),
      tipe: nullableText(row.tipe) || "domisili",
      jalan: nullableText(row.jalan),
      kelurahan: nullableText(row.kelurahan),
      kecamatan: nullableText(row.kecamatan),
      kota_kabupaten: nullableText(row.kota_kabupaten),
      provinsi: nullableText(row.provinsi),
      kode_provinsi: nullableText(row.kode_provinsi),
      kode_kota_kab: nullableText(row.kode_kota_kab),
      kode_kecamatan: nullableText(row.kode_kecamatan),
      kode_kelurahan: nullableText(row.kode_kelurahan),
      created_at: nullableDateText(row.created_at) || new Date().toISOString().slice(0, 10)
    };
    await pool.query(
      `INSERT INTO ${TABLES.alamat}
       (\`id\`, \`id_pegawai\`, \`tipe\`, \`jalan\`, \`kelurahan\`, \`kecamatan\`, \`kota_kabupaten\`, \`provinsi\`, \`kode_provinsi\`, \`kode_kota_kab\`, \`kode_kecamatan\`, \`kode_kelurahan\`, \`created_at\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.id_pegawai,
        record.tipe,
        record.jalan,
        record.kelurahan,
        record.kecamatan,
        record.kota_kabupaten,
        record.provinsi,
        record.kode_provinsi,
        record.kode_kota_kab,
        record.kode_kecamatan,
        record.kode_kelurahan,
        record.created_at
      ]
    );
  }
}

async function replacePasanganRows(pool, idPegawai, pasanganRows = []) {
  await pool.query(`DELETE FROM ${TABLES.pasangan} WHERE \`id_pegawai\` = ?`, [Number(idPegawai)]);
  const filtered = pasanganRows.filter(isPasanganFilled);
  if (!filtered.length) return;

  let nextId = await getNextNumericId(pool, TABLES.pasangan);
  for (const row of filtered) {
    await pool.query(
      `INSERT INTO ${TABLES.pasangan}
       (\`id\`, \`id_pegawai\`, \`status_punya\`, \`nama\`, \`no_tlp\`, \`email\`, \`pekerjaan\`, \`created_at\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nextId++,
        Number(idPegawai),
        nullableText(row.status_punya),
        nullableText(row.nama),
        nullableText(row.no_tlp),
        nullableText(row.email),
        nullableText(row.pekerjaan),
        nullableDateText(row.created_at) || new Date().toISOString().slice(0, 10)
      ]
    );
  }
}

async function replaceAnakRows(pool, idPegawai, anakRows = []) {
  await pool.query(`DELETE FROM ${TABLES.anak} WHERE \`id_pegawai\` = ?`, [Number(idPegawai)]);
  const filtered = anakRows.filter(isAnakFilled);
  if (!filtered.length) return;

  let nextId = await getNextNumericId(pool, TABLES.anak);
  let urutan = 1;
  for (const row of filtered) {
    await pool.query(
      `INSERT INTO ${TABLES.anak}
       (\`id\`, \`id_pegawai\`, \`urutan\`, \`nama\`, \`jenis_kelamin\`, \`tempat_lahir\`, \`tanggal_lahir\`, \`pekerjaan\`, \`created_at\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nextId++,
        Number(idPegawai),
        urutan++,
        nullableText(row.nama),
        nullableText(row.jenis_kelamin),
        nullableText(row.tempat_lahir),
        nullableDateText(row.tanggal_lahir),
        nullableText(row.pekerjaan),
        nullableDateText(row.created_at) || new Date().toISOString().slice(0, 10)
      ]
    );
  }
}

async function replaceRiwayatJabatanRows(pool, pegawai, rows = []) {
  await pool.query(`DELETE FROM ${TABLES.riwayatJabatan} WHERE \`id_pegawai\` = ?`, [Number(pegawai.id_pegawai)]);
  const filtered = rows.filter(isRiwayatJabatanFilled);
  if (!filtered.length) return;

  for (const [index, item] of filtered.entries()) {
    const record = buildRiwayatJabatanRecord(item, pegawai, index + 1);
    await pool.query(
      `INSERT INTO ${TABLES.riwayatJabatan}
       (\`id_pegawai\`, \`nip\`, \`nama_pegawai\`, \`gelar_depan\`, \`gelar_belakang\`, \`nama_jabatan_orb\`, \`nama_jabatan_menpan\`, \`struktur_atasan_langsung\`, \`nama_ukpd\`, \`wilayah\`, \`jenis_pegawai\`, \`status_rumpun\`, \`tmt_jabatan\`, \`nomor_sk\`, \`tanggal_sk\`, \`keterangan\`, \`sumber\`, \`source_key\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id_pegawai,
        record.nip,
        record.nama_pegawai,
        record.gelar_depan,
        record.gelar_belakang,
        record.nama_jabatan_orb,
        record.nama_jabatan_menpan,
        record.struktur_atasan_langsung,
        record.nama_ukpd,
        record.wilayah,
        record.jenis_pegawai,
        record.status_rumpun,
        record.tmt_jabatan,
        record.nomor_sk,
        record.tanggal_sk,
        record.keterangan,
        record.sumber,
        record.source_key
      ]
    );
  }
}

async function replaceRiwayatPangkatRows(pool, pegawai, rows = []) {
  await pool.query(`DELETE FROM ${TABLES.riwayatPangkat} WHERE \`id_pegawai\` = ?`, [Number(pegawai.id_pegawai)]);
  const filtered = rows.filter(isRiwayatPangkatFilled);
  if (!filtered.length) return;

  for (const [index, item] of filtered.entries()) {
    const record = buildRiwayatPangkatRecord(item, pegawai, index + 1);
    await pool.query(
      `INSERT INTO ${TABLES.riwayatPangkat}
       (\`id_pegawai\`, \`nip\`, \`nama_pegawai\`, \`pangkat_golongan\`, \`tmt_pangkat\`, \`nomor_sk\`, \`tanggal_sk\`, \`keterangan\`, \`sumber\`, \`source_key\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id_pegawai,
        record.nip,
        record.nama_pegawai,
        record.pangkat_golongan,
        record.tmt_pangkat,
        record.nomor_sk,
        record.tanggal_sk,
        record.keterangan,
        record.sumber,
        record.source_key
      ]
    );
  }
}

async function syncPegawaiRelations(pool, pegawai, data) {
  const alamatRows = [
    { tipe: "ktp", ...(data.alamat_ktp || {}) },
    { tipe: "domisili", ...(data.alamat_domisili || {}) }
  ];
  await replaceAlamatRows(pool, pegawai.id_pegawai, alamatRows);
  await replacePasanganRows(pool, pegawai.id_pegawai, Array.isArray(data.pasangan) ? data.pasangan : data.pasangan ? [data.pasangan] : []);
  await replaceAnakRows(pool, pegawai.id_pegawai, data.anak || []);
  await replaceRiwayatJabatanRows(pool, pegawai, data.riwayat_jabatan || []);
  await replaceRiwayatPangkatRows(pool, pegawai, data.riwayat_pangkat || []);
}

function pickPegawaiColumns(item) {
  return PEGAWAI_COLUMNS.filter((column) => Object.prototype.hasOwnProperty.call(item, column));
}

export async function createPegawaiData(data) {
  const pool = await getConnectedPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const nextPegawaiId = await getNextNumericId(connection, TABLES.pegawai, "id_pegawai");
    const item = {
      id_pegawai: Number(nextPegawaiId),
      created_at: new Date().toISOString().slice(0, 10),
      ...data
    };

    const columns = pickPegawaiColumns(item);
    const placeholders = columns.map(() => "?").join(", ");
    const values = columns.map((column) => item[column] ?? null);
    await connection.query(
      `INSERT INTO ${TABLES.pegawai} (${columns.map((column) => `\`${column}\``).join(", ")}) VALUES (${placeholders})`,
      values
    );

    await syncPegawaiRelations(connection, item, data);
    await connection.commit();
    return item;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updatePegawaiData(id, data) {
  const pool = await getConnectedPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const columns = PEGAWAI_MUTABLE_COLUMNS.filter((column) => Object.prototype.hasOwnProperty.call(data, column));
    if (columns.length) {
      await connection.query(
        `UPDATE ${TABLES.pegawai} SET ${columns.map((column) => `\`${column}\` = ?`).join(", ")} WHERE \`id_pegawai\` = ?`,
        [...columns.map((column) => data[column] ?? null), Number(id)]
      );
    }

    const [rows] = await connection.query(`SELECT * FROM ${TABLES.pegawai} WHERE \`id_pegawai\` = ? LIMIT 1`, [Number(id)]);
    const current = rows[0] ? normalizeRow(rows[0]) : null;
    if (!current) {
      await connection.rollback();
      return null;
    }

    await syncPegawaiRelations(connection, current, data);
    await connection.commit();
    return current;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deletePegawaiData(id) {
  const pool = await getConnectedPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(`DELETE FROM ${TABLES.alamat} WHERE \`id_pegawai\` = ?`, [Number(id)]);
    await connection.query(`DELETE FROM ${TABLES.pasangan} WHERE \`id_pegawai\` = ?`, [Number(id)]);
    await connection.query(`DELETE FROM ${TABLES.anak} WHERE \`id_pegawai\` = ?`, [Number(id)]);
    await connection.query(`DELETE FROM ${TABLES.riwayatJabatan} WHERE \`id_pegawai\` = ?`, [Number(id)]);
    await connection.query(`DELETE FROM ${TABLES.riwayatPangkat} WHERE \`id_pegawai\` = ?`, [Number(id)]);
    await connection.query(`DELETE FROM ${TABLES.riwayatPendidikan} WHERE \`id_pegawai\` = ?`, [Number(id)]);
    await connection.query(`DELETE FROM ${TABLES.pegawai} WHERE \`id_pegawai\` = ?`, [Number(id)]);
    await connection.commit();
    return { id_pegawai: Number(id) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
