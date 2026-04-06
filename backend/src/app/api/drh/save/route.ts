import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

function toText(v: unknown): string {
  return String(v ?? "").trim();
}

function toSqlDate(v?: string | null): string | null {
  const t = String(v ?? "").trim();
  return t ? t : null;
}

function toIntDigits(v: unknown): number {
  const digits = String(v ?? "").replace(/\D+/g, "");
  return digits ? Number(digits) : 0;
}

function normalisasiJenisJabatan(raw: unknown): "STR" | "FUN" | null {
  const t = toText(raw).toUpperCase();
  if (!t || t === "-") return null;
  if (t.includes("STR")) return "STR";
  if (t.includes("FUN")) return "FUN";
  return null;
}

function splitNamaGelar(namaRaw: string): { nama: string; gelar_depan: string; gelar_belakang: string } {
  let t = toText(namaRaw);
  if (!t) return { nama: "", gelar_depan: "", gelar_belakang: "" };

  const prefixRe = /^(DR\.?|DRG\.?|PROF\.?|H\.|IR\.|Hj\.|H\.?J\.?|H\.?M\.?|H\.?S\.?|H\.?A\.?|H\.?R\.?|H\.?B\.?|H\.?N\.?)\s+/i;
  const prefixes: string[] = [];
  let prefixMatch = t.match(prefixRe);
  while (prefixMatch) {
    prefixes.push(prefixMatch[1].replace(/\.$/, ''));
    t = t.slice(prefixMatch[0].length).trim();
    prefixMatch = t.match(prefixRe);
  }

  const suffixParts: string[] = [];
  if (t.includes(',')) {
    const parts = t.split(',').map((p) => p.trim()).filter(Boolean);
    t = parts.shift() || t;
    suffixParts.push(...parts);
  }

  const tokens = t.split(/\s+/).filter(Boolean);
  const recognizedSuffix = new Set([
    "S.ST",
    "S.SI",
    "S.KM",
    "S.KOM",
    "S.T",
    "S.KED",
    "S.KG",
    "S.FARM",
    "S.FT",
    "S.PD",
    "S.AG",
    "S.SOS",
    "S.H",
    "S.IP",
    "S.I",
    "SE",
    "SH",
    "SKM",
    "SKG",
    "SST",
    "S.S.T",
    "A.MD",
    "A.MK",
    "A.MG",
    "A.MD.K",
    "D3",
    "D4",
    "M.KES",
    "M.KM",
    "M.KM.",
    "M.SI",
    "M.Si",
    "M.M",
    "M.A",
    "M.H",
    "M.T",
    "M.PD",
    "M.KOM",
    "M.FARM",
    "PH.D",
    "PH D",
    "DR",
    "Sp",
  ]);

  const suffixTokens: string[] = [];
  while (tokens.length) {
    const last = tokens[tokens.length - 1];
    const lastClean = last.replace(/[^A-Za-z0-9.]/g, '').toUpperCase();
    if (recognizedSuffix.has(lastClean) || /^[A-Z]{1,3}\.?[A-Z]{0,3}\.?$/.test(lastClean)) {
      suffixTokens.unshift(tokens.pop() as string);
      continue;
    }
    break;
  }

  const nama = tokens.join(' ').trim();
  const gelar_depan = prefixes.join(' ').trim();
  const gelar_belakang = [...suffixParts, ...suffixTokens].join(' ').replace(/\s*,\s*/g, ', ').trim();

  return { nama, gelar_depan, gelar_belakang };
}

function normalizeTingkat(raw: unknown): string {
  const t = toText(raw).toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  return t;
}

function pickLatestByTmt(rows: any[]): any | null {
  if (!rows || !rows.length) return null;
  let best: any = null;
  let bestTime = 0;
  for (const row of rows) {
    const tmt = toSqlDate(row?.tmt);
    if (!tmt) continue;
    const time = new Date(tmt).getTime();
    if (!best || time > bestTime) {
      best = row;
      bestTime = time;
    }
  }
  return best;
}

function pickHighestPendidikan(
  rows: any[]
): { tingkat: string; jurusan: string; nama_sekolah: string; tanggal_ijazah: string | null; kota: string } | null {
  if (!rows || !rows.length) return null;
  const rank: Record<string, number> = {
    SD: 1,
    SMP: 2,
    SMA: 3,
    SMK: 3,
    D3: 4,
    D4: 5,
    S1: 6,
    S2: 7,
    S3: 8,
  };
  let best: any = null;
  for (const row of rows) {
    const tingkat = normalizeTingkat(row?.tingkat);
    if (!tingkat) continue;
    const r = rank[tingkat] ?? 0;
    const tgl = toSqlDate(row?.tgl_ijazah || row?.tanggal_ijazah);
    const tglTime = tgl ? new Date(tgl).getTime() : 0;
    if (!best) {
      best = { row, rank: r, tglTime };
      continue;
    }
    if (r > best.rank || (r === best.rank && tglTime > best.tglTime)) {
      best = { row, rank: r, tglTime };
    }
  }
  if (!best) return null;
  return {
    tingkat: normalizeTingkat(best.row?.tingkat),
    jurusan: toText(best.row?.jurusan),
    nama_sekolah: toText(best.row?.nama_sekolah),
    tanggal_ijazah: toSqlDate(best.row?.tgl_ijazah || best.row?.tanggal_ijazah),
    kota: toText(best.row?.kota),
  };
}

async function getTableColumns(conn: mysql.Connection, table: string): Promise<Set<string>> {
  const [rows] = await conn.execute<any[]>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return new Set((rows || []).map((r) => String(r.COLUMN_NAME)));
}

async function getExistingTables(conn: mysql.Connection, tables: string[]): Promise<Set<string>> {
  if (!tables.length) return new Set();
  const placeholders = tables.map(() => "?").join(",");
  const [rows] = await conn.execute<any[]>(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`,
    tables
  );
  return new Set((rows || []).map((r) => String(r.TABLE_NAME)));
}

async function insertRows(
  conn: mysql.Connection,
  table: string,
  idPegawai: number,
  columns: string[],
  rows: Array<Record<string, any>>
) {
  if (!rows || rows.length === 0) return;
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO ${table} (id_pegawai, ${columns.join(", ")}) VALUES (?, ${placeholders})`;
  for (const row of rows) {
    const values = columns.map((col) => row[col] ?? null);
    if (!values.some((v) => v !== null && v !== undefined && v !== "")) {
      continue;
    }
    await conn.execute(sql, [idPegawai, ...values]);
  }
}

export async function POST(req: Request) {
  let conn: mysql.Connection | null = null;

  try {
    const body = await req.json();

    let nip = toText(body.nip);
    let nrk = toText(body.nrk);
    let nik = toText(body.nik);
    const nama = toText(body.nama);
    const namaSplit = splitNamaGelar(nama);

    if (!nik && nip) nik = nip;
    if (!nik && nrk) nik = nrk;

    if (!nip && !nrk) {
      return NextResponse.json({ error: "NIP/NRK minimal harus terisi satu." }, { status: 400 });
    }
    if (!nama) {
      return NextResponse.json({ error: "Nama pegawai masih kosong." }, { status: 400 });
    }

    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || "3306"),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      charset: "utf8mb4",
    });

    await conn.beginTransaction();

    const masterColumns = await getTableColumns(conn, "pegawai_master");
    const tempat_lahir = toText(body.tempat_lahir);
    const tanggal_lahir = toSqlDate(body.tanggal_lahir);
    const agama = toText(body.agama);
    const jenis_kelamin = toText(body.jenis_kelamin);
    const status_perkawinan = toText(body.status_perkawinan);
    const status_rumpun = toText(body.status_rumpun);
    const no_hp = toText(body.no_hp);
    const email = toText(body.email);
    const nama_ukpd_body = toText(body.nama_ukpd);

    const pendidikanFormal = Array.isArray(body.pendidikan_formal) ? body.pendidikan_formal : [];
    const pendidikanSummary = pickHighestPendidikan(pendidikanFormal);

    const pangkatRows = Array.isArray(body.riwayat_pangkat) ? body.riwayat_pangkat : [];
    const latestPangkat = pangkatRows.reduce<any>((acc, row) => {
      const tmt = toSqlDate(row?.tmt);
      const tmtTime = tmt ? new Date(tmt).getTime() : 0;
      if (!acc || tmtTime > acc.tmtTime) {
        return { row, tmtTime };
      }
      return acc;
    }, null);
    const latestPangkatRow = pickLatestByTmt(pangkatRows);
    const jabatanRows = Array.isArray(body.riwayat_jabatan) ? body.riwayat_jabatan : [];
    const latestJabatanRow = pickLatestByTmt(jabatanRows);
    const tmtUkpd = latestJabatanRow?.tmt ? toSqlDate(latestJabatanRow.tmt) : null;

    const jenisPegawai = (() => {
      const hay = [
        nama,
        nip,
        nrk,
        toText(latestJabatanRow?.jabatan),
        toText(latestJabatanRow?.lokasi),
        toText(latestJabatanRow?.no_sk),
        toText(latestPangkatRow?.pangkat),
        toText(latestPangkatRow?.lokasi),
        toText(latestPangkatRow?.no_sk),
      ]
        .join(" ")
        .toUpperCase();
      if (hay.includes("PPPK") || hay.includes("P3K")) return "PPPK";
      if (hay.includes("CPNS")) return "CPNS";
      if (nip) return "PNS";
      return "";
    })();

    const [foundRows] = await conn.execute<any[]>(
      `
      SELECT id_pegawai
      FROM pegawai_master
      WHERE (nip <> '' AND nip = ?)
         OR (nrk <> '' AND nrk = ?)
      LIMIT 1
      `,
      [nip, nrk]
    );

    let idPegawai: number | null = foundRows?.[0]?.id_pegawai ?? null;

    if (!idPegawai) {
      const insertCols: string[] = [];
      const insertVals: any[] = [];

      const pushCol = (col: string, value: any) => {
        if (!masterColumns.has(col)) return;
        if (value === undefined || value === null || value === "") return;
        insertCols.push(col);
        insertVals.push(value);
      };

      const namaForSave = namaSplit.nama || nama;
      pushCol("nama", namaForSave);
      pushCol("nip", nip || null);
      pushCol("nrk", nrk || null);
      pushCol("nik", nik || null);
      pushCol("tempat_lahir", tempat_lahir || null);
      pushCol("tanggal_lahir", tanggal_lahir || null);
      pushCol("agama", agama || null);
      pushCol("jenis_kelamin", jenis_kelamin || null);
      pushCol("status_perkawinan", status_perkawinan || null);
      pushCol("no_hp_pegawai", no_hp || null);
      pushCol("email", email || null);
      pushCol("jenjang_pendidikan", pendidikanSummary?.tingkat || null);
      pushCol("program_studi", pendidikanSummary?.jurusan || null);
      pushCol("nama_universitas", pendidikanSummary?.nama_sekolah || null);
      pushCol("pangkat_golongan", latestPangkat?.row?.pangkat ? toText(latestPangkat.row.pangkat) : null);
      pushCol("tmt_pangkat_terakhir", latestPangkat?.row?.tmt ? toSqlDate(latestPangkat.row.tmt) : null);
      pushCol("nama_ukpd", nama_ukpd_body || toText(latestPangkatRow?.lokasi) || null);
      pushCol("nama_jabatan_orb", toText(latestJabatanRow?.jabatan) || null);
      pushCol("nama_jabatan_menpan", toText(latestJabatanRow?.jabatan) || null);
      pushCol("jenis_pegawai", jenisPegawai || null);
      pushCol("status_rumpun", status_rumpun || null);
      pushCol("tmt_kerja_ukpd", tmtUkpd);
      pushCol("kondisi", "AKTIF");
      pushCol("gelar_depan", namaSplit.gelar_depan || null);
      pushCol("gelar_belakang", namaSplit.gelar_belakang || null);

      const placeholders = insertCols.map(() => "?").join(", ");
      const [insRes] = await conn.execute<any>(
        `INSERT INTO pegawai_master (${insertCols.join(", ")}) VALUES (${placeholders})`,
        insertVals
      );
      idPegawai = insRes?.insertId ?? null;
    } else {
      const sets: string[] = [];
      const values: any[] = [];

      if (masterColumns.has("nama")) {
        sets.push("nama = ?");
        values.push(namaSplit.nama || nama);
      }

      const addFill = (col: string, value: any, isDate = false) => {
        if (!masterColumns.has(col)) return;
        if (value === undefined || value === null || value === "") return;
        const dateGuard = isDate ? ` OR ${col} = '0000-00-00'` : "";
        sets.push(`${col} = IF(${col} IS NULL OR ${col} = ''${dateGuard}, ?, ${col})`);
        values.push(value);
      };

      addFill("nip", nip || null);
      addFill("nrk", nrk || null);
      addFill("nik", nik || null);
      addFill("tempat_lahir", tempat_lahir || null);
      addFill("tanggal_lahir", tanggal_lahir || null, true);
      addFill("agama", agama || null);
      addFill("jenis_kelamin", jenis_kelamin || null);
      addFill("status_perkawinan", status_perkawinan || null);
      addFill("no_hp_pegawai", no_hp || null);
      addFill("email", email || null);
      addFill("jenjang_pendidikan", pendidikanSummary?.tingkat || null);
      addFill("program_studi", pendidikanSummary?.jurusan || null);
      addFill("nama_universitas", pendidikanSummary?.nama_sekolah || null);
      addFill("pangkat_golongan", latestPangkat?.row?.pangkat ? toText(latestPangkat.row.pangkat) : null);
      addFill("tmt_pangkat_terakhir", latestPangkat?.row?.tmt ? toSqlDate(latestPangkat.row.tmt) : null, true);
      addFill("nama_ukpd", toText(latestPangkatRow?.lokasi) || null);
      addFill("nama_jabatan_orb", toText(latestJabatanRow?.jabatan) || null);
      addFill("nama_jabatan_menpan", toText(latestJabatanRow?.jabatan) || null);
      addFill("jenis_pegawai", jenisPegawai || null);
      addFill("status_rumpun", status_rumpun || null);
      addFill("tmt_kerja_ukpd", tmtUkpd, true);
      addFill("gelar_depan", namaSplit.gelar_depan || null);
      addFill("gelar_belakang", namaSplit.gelar_belakang || null);
      if (nama_ukpd_body && masterColumns.has("nama_ukpd")) {
        sets.push("nama_ukpd = ?");
        values.push(nama_ukpd_body);
      }
      if (masterColumns.has("kondisi")) {
        sets.push("kondisi = ?");
        values.push("AKTIF");
      }

      if (sets.length) {
        await conn.execute(`UPDATE pegawai_master SET ${sets.join(", ")} WHERE id_pegawai = ?`, [...values, idPegawai]);
      }
    }

    const alamat_jalan = toText(body.alamat_jalan);
    const alamat_rt = toText(body.alamat_rt);
    const alamat_rw = toText(body.alamat_rw);
    const alamat_kelurahan = toText(body.alamat_kelurahan);
    const alamat_kecamatan = toText(body.alamat_kecamatan);
    const alamat_kota = toText(body.alamat_kota);
    const alamat_provinsi = toText(body.alamat_provinsi);

    if (alamat_jalan || alamat_kelurahan || alamat_kecamatan || alamat_kota) {
      const [addrRows] = await conn.execute<any[]>(
        `SELECT id FROM alamat WHERE id_pegawai = ? AND tipe = 'DOMISILI' LIMIT 1`,
        [idPegawai]
      );
      const existingId: number | null = addrRows?.[0]?.id ?? null;
      let jalan_full = alamat_jalan;
      if (alamat_rt || alamat_rw) {
        jalan_full = `${alamat_jalan} RT ${alamat_rt} / ${alamat_rw}`.trim();
      }

      if (existingId) {
        await conn.execute(
          `UPDATE alamat SET jalan = ?, kelurahan = ?, kecamatan = ?, kota_kabupaten = ?, provinsi = ? WHERE id = ?`,
          [
            jalan_full || null,
            alamat_kelurahan || null,
            alamat_kecamatan || null,
            alamat_kota || null,
            alamat_provinsi || null,
            existingId,
          ]
        );
      } else {
        await conn.execute(
          `
          INSERT INTO alamat
            (id_pegawai, tipe, jalan, kelurahan, kecamatan, kota_kabupaten, provinsi)
          VALUES
            (?, 'DOMISILI', ?, ?, ?, ?, ?)
          `,
          [
            idPegawai,
            jalan_full || null,
            alamat_kelurahan || null,
            alamat_kecamatan || null,
            alamat_kota || null,
            alamat_provinsi || null,
          ]
        );
      }
    }
    const keluarga = Array.isArray(body.keluarga) ? body.keluarga : [];
    let anakUrutFallback = 1;
    for (const row of keluarga) {
      const hubungan = toText(row?.hubungan).toUpperCase();
      const nama_keluarga = toText(row?.nama);
      if (!hubungan || !nama_keluarga) continue;

      const tempat_lahir_keluarga = toText(row?.tempat_lahir);
      const tanggal_lahir_keluarga = toSqlDate(row?.tanggal_lahir);
      const jenis_kelamin_keluarga = toText(row?.jenis_kelamin).toUpperCase();
      const pekerjaan = toText(row?.pekerjaan);
      const tunjangan = row?.tunjangan !== undefined && row?.tunjangan !== null ? Number(row?.tunjangan) : 0;

      if (hubungan.includes("SUAMI") || hubungan.includes("ISTERI")) {
        const [sel] = await conn.execute<any[]>(
          `SELECT id FROM pasangan WHERE id_pegawai = ? LIMIT 1`,
          [idPegawai]
        );
        const id: number | null = sel?.[0]?.id ?? null;
        const jk = jenis_kelamin_keluarga === "L" || jenis_kelamin_keluarga === "P" ? jenis_kelamin_keluarga : null;

        if (id) {
          await conn.execute(
            `UPDATE pasangan
             SET status_punya = 'YA',
                 nama = ?,
                 pekerjaan = ?,
                 tempat_lahir = ?,
                 tanggal_lahir = ?,
                 jenis_kelamin = ?,
                 tunjangan = ?
             WHERE id = ?`,
            [
              nama_keluarga,
              pekerjaan || null,
              tempat_lahir_keluarga || null,
              tanggal_lahir_keluarga,
              jk,
              Number.isFinite(tunjangan) ? tunjangan : 0,
              id,
            ]
          );
        } else {
          await conn.execute(
            `INSERT INTO pasangan
              (id_pegawai, status_punya, nama, pekerjaan, tempat_lahir, tanggal_lahir, jenis_kelamin, tunjangan)
             VALUES
              (?, 'YA', ?, ?, ?, ?, ?, ?)`,
            [
              idPegawai,
              nama_keluarga,
              pekerjaan || null,
              tempat_lahir_keluarga || null,
              tanggal_lahir_keluarga,
              jk,
              Number.isFinite(tunjangan) ? tunjangan : 0,
            ]
          );
        }
      } else if (hubungan.includes("ANAK")) {
        const m = hubungan.match(/ANAK\s*(\d+)/i);
        const urutan = m ? Number(m[1]) : anakUrutFallback++;
        const jk = jenis_kelamin_keluarga === "L" || jenis_kelamin_keluarga === "P" ? jenis_kelamin_keluarga : null;

        const [sel] = await conn.execute<any[]>(
          `SELECT id FROM anak WHERE id_pegawai = ? AND urutan = ? LIMIT 1`,
          [idPegawai, urutan]
        );
        const id: number | null = sel?.[0]?.id ?? null;

        if (id) {
          await conn.execute(
            `UPDATE anak SET nama = ?, jenis_kelamin = ?, tempat_lahir = ?, tanggal_lahir = ?, pekerjaan = ? WHERE id = ?`,
            [nama_keluarga, jk, tempat_lahir_keluarga || null, tanggal_lahir_keluarga, pekerjaan || null, id]
          );
        } else {
          await conn.execute(
            `INSERT INTO anak (id_pegawai, urutan, nama, jenis_kelamin, tempat_lahir, tanggal_lahir, pekerjaan) VALUES (?,?,?,?,?,?,?)`,
            [idPegawai, urutan, nama_keluarga, jk, tempat_lahir_keluarga || null, tanggal_lahir_keluarga, pekerjaan || null]
          );
        }
      }
    }

    const rJabatan = Array.isArray(body.riwayat_jabatan) ? body.riwayat_jabatan : [];
    const rPangkat = Array.isArray(body.riwayat_pangkat) ? body.riwayat_pangkat : [];
    const rGaji = Array.isArray(body.riwayat_gaji) ? body.riwayat_gaji : [];
    const pendidikanNonformal = Array.isArray(body.pendidikan_nonformal) ? body.pendidikan_nonformal : [];

    const drhTables = [
      "drh_gaji_pokok",
      "drh_jabatan_fungsional",
      "drh_jabatan_struktural",
      "drh_pangkat",
      "drh_pendidikan_formal",
      "drh_pendidikan_nonformal",
    ];
    const existingTables = await getExistingTables(conn, drhTables);

    if (existingTables.has("drh_pendidikan_formal")) {
      await conn.execute("DELETE FROM drh_pendidikan_formal WHERE id_pegawai = ?", [idPegawai]);
      await insertRows(
        conn,
        "drh_pendidikan_formal",
        idPegawai,
        ["tingkat", "jurusan", "tanggal_ijazah", "nama_sekolah", "kota"],
        pendidikanFormal.map((row: any) => ({
          tingkat: toText(row?.tingkat),
          jurusan: toText(row?.jurusan),
          tanggal_ijazah: toSqlDate(row?.tgl_ijazah || row?.tanggal_ijazah),
          nama_sekolah: toText(row?.nama_sekolah),
          kota: toText(row?.kota),
        }))
      );
    }

    if (existingTables.has("drh_pendidikan_nonformal")) {
      await conn.execute("DELETE FROM drh_pendidikan_nonformal WHERE id_pegawai = ?", [idPegawai]);
      await insertRows(
        conn,
        "drh_pendidikan_nonformal",
        idPegawai,
        ["nama_pelatihan", "tanggal_ijazah", "penyelenggara", "kota"],
        pendidikanNonformal.map((row: any) => ({
          nama_pelatihan: toText(row?.nama_sekolah || row?.nama_pelatihan),
          tanggal_ijazah: toSqlDate(row?.tgl_ijazah || row?.tanggal_ijazah),
          penyelenggara: toText(row?.penyelenggara),
          kota: toText(row?.kota),
        }))
      );
    }

    if (existingTables.has("drh_jabatan_struktural")) {
      await conn.execute("DELETE FROM drh_jabatan_struktural WHERE id_pegawai = ?", [idPegawai]);
      const rows = rJabatan
        .filter((row: any) => normalisasiJenisJabatan(row?.jenis) === "STR")
        .map((row: any) => ({
          tmt: toSqlDate(row?.tmt),
          lokasi: toText(row?.lokasi),
          jabatan: toText(row?.jabatan),
          pangkat: toText(row?.pangkat),
          eselon: toText(row?.eselon),
          no_sk: toText(row?.no_sk),
          tanggal_sk: toSqlDate(row?.tgl_sk),
        }));
      await insertRows(
        conn,
        "drh_jabatan_struktural",
        idPegawai,
        ["tmt", "lokasi", "jabatan", "pangkat", "eselon", "no_sk", "tanggal_sk"],
        rows
      );
    }

    if (existingTables.has("drh_jabatan_fungsional")) {
      await conn.execute("DELETE FROM drh_jabatan_fungsional WHERE id_pegawai = ?", [idPegawai]);
      const rows = rJabatan
        .filter((row: any) => normalisasiJenisJabatan(row?.jenis) === "FUN")
        .map((row: any) => ({
          tmt: toSqlDate(row?.tmt),
          jabatan: toText(row?.jabatan),
          pangkat: toText(row?.pangkat),
          no_sk: toText(row?.no_sk),
          tanggal_sk: toSqlDate(row?.tgl_sk),
        }));
      await insertRows(conn, "drh_jabatan_fungsional", idPegawai, ["tmt", "jabatan", "pangkat", "no_sk", "tanggal_sk"], rows);
    }

    if (existingTables.has("drh_pangkat")) {
      await conn.execute("DELETE FROM drh_pangkat WHERE id_pegawai = ?", [idPegawai]);
      await insertRows(
        conn,
        "drh_pangkat",
        idPegawai,
        ["tmt", "pangkat", "lokasi", "no_sk", "tanggal_sk"],
        rPangkat.map((row: any) => ({
          tmt: toSqlDate(row?.tmt),
          pangkat: toText(row?.pangkat),
          lokasi: toText(row?.lokasi),
          no_sk: toText(row?.no_sk),
          tanggal_sk: toSqlDate(row?.tgl_sk),
        }))
      );
    }

    if (existingTables.has("drh_gaji_pokok")) {
      await conn.execute("DELETE FROM drh_gaji_pokok WHERE id_pegawai = ?", [idPegawai]);
      await insertRows(
        conn,
        "drh_gaji_pokok",
        idPegawai,
        ["tmt", "pangkat", "gaji", "no_sk", "tanggal_sk"],
        rGaji.map((row: any) => ({
          tmt: toSqlDate(row?.tmt),
          pangkat: toText(row?.pangkat),
          gaji: toIntDigits(row?.gaji),
          no_sk: toText(row?.no_sk),
          tanggal_sk: toSqlDate(row?.tgl_sk),
        }))
      );
    }

    await conn.commit();
    await conn.end();

    return NextResponse.json({ message: "Data DRH tersimpan di pegawai_master/alamat/pasangan/anak dan tabel DRH." }, { status: 200 });
  } catch (e: any) {
    try {
      if (conn) await conn.rollback();
    } catch {}
    try {
      if (conn) await conn.end();
    } catch {}
    return NextResponse.json({ error: "Gagal menyimpan: " + (e?.message || String(e)) }, { status: 500 });
  }
}
