'use client';

import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Script from 'next/script';
import React, { useEffect, useMemo, useState } from 'react';
import { logout, saveDrh } from '@/lib/api';
import { getStoredUser, roleLabel } from '@/lib/auth';
import { navItems } from '@/lib/nav';

type Toast = { id: number; type: 'success' | 'error'; message: string };

type PFRow = { tingkat: string; jurusan: string; tgl_ijazah: string; nama_sekolah: string; kota: string };
type PNRow = { tgl_ijazah: string; nama_sekolah: string; kota: string };

type JabRow = {
  jenis: string;
  tmt: string;
  lokasi: string;
  jabatan: string;
  pangkat: string;
  eselon: string;
  no_sk: string;
  tgl_sk: string;
};

type PangkatRow = {
  tmt: string;
  pangkat: string;
  lokasi: string;
  no_sk: string;
  tgl_sk: string;
};

type GajiRow = {
  tmt: string;
  pangkat: string;
  gaji: string;
  no_sk: string;
  tgl_sk: string;
};

type KeluargaRow = {
  hubungan: string;
  nama: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  jenis_kelamin: string;
  tunjangan: number;
  pekerjaan: string;
};

/* ========================= Helper Functions ========================= */

function dmyToYmd(s: string) {
  const m = s?.match?.(/(\d{2})-(\d{2})-(\d{4})/);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function getFirstMatch(re: RegExp, text: string) {
  const m = text.match(re);
  return m ? (m[1] || '').trim() : '';
}

function getBlock(text: string, startRe: RegExp, endRe: RegExp) {
  const s = text.search(startRe);
  if (s < 0) return '';
  let sub = text.slice(s);
  const eIdx = sub.search(endRe);
  if (eIdx >= 0) sub = sub.slice(0, eIdx);
  return sub;
}

function buildRowStrings(block: string) {
  const lines = block
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length);

  const rows: string[] = [];
  let cur: string | null = null;

  for (const line of lines) {
    if (/^NO\b/i.test(line)) continue;
    const m = line.match(/^(\d+)\s+(.*)$/);
    if (m) {
      if (cur) rows.push(cur.trim());
      cur = m[2].trim();
    } else if (cur) {
      cur += ' ' + line;
    }
  }
  if (cur) rows.push(cur.trim());
  return rows;
}

function splitNamaKota(afterTokens: string[]) {
  if (!afterTokens?.length) return { nama: '', kota: '' };

  const knownCities = [
    'JAKARTA',
    'JAKARTA BARAT',
    'JAKARTA TIMUR',
    'JAKARTA PUSAT',
    'JAKARTA SELATAN',
    'JAKARTA UTARA',
    'BEKASI',
    'DEPOK',
    'BOGOR',
    'TANGERANG',
    'TANGERANG SELATAN',
    'BANDUNG',
    'YOGYAKARTA',
    'SURABAYA',
    'SEMARANG',
    'MEDAN',
    'PALEMBANG',
  ];

  const tail = afterTokens.join(' ').trim();
  const up = tail.toUpperCase();

  let nama = tail;
  let kota = '';

  for (const city of knownCities) {
    const idx = up.lastIndexOf(city);
    if (idx >= 0) {
      nama = tail.slice(0, idx).trim();
      kota = tail.slice(idx).trim();
      break;
    }
  }

  if (!kota) {
    let i = afterTokens.length - 1;
    let started = false;
    while (i >= 0) {
      const t = afterTokens[i];
      const isUpper = t.toUpperCase() === t && /[A-Z]/.test(t);
      if (isUpper) {
        started = true;
        i--;
        continue;
      }
      if (started) break;
      i--;
    }
    const start = i + 1;
    if (start < afterTokens.length) {
      kota = afterTokens.slice(start).join(' ').trim();
      nama = afterTokens.slice(0, start).join(' ').trim();
    }
  }

  return { nama, kota };
}

function normalisasiJenisJabatan(raw: string) {
  const t = (raw || '').toUpperCase().trim();
  if (!t || t === '-') return '';
  if (t.includes('STR')) return 'STR';
  if (t.includes('FUN')) return 'FUN';
  return '';
}

function findEmail(text: string) {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0].trim() : '';
}

function cleanLines(block: string) {
  return block
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length);
}

function isDateDMY(s: string) {
  return /^\d{2}-\d{2}-\d{4}$/.test(s);
}

function isUpperCityLine(s: string) {
  return s.toUpperCase() === s && /[A-Z]/.test(s) && s.length <= 40;
}

function isKnownCityLine(s: string) {
  const up = s.toUpperCase().replace(/\s+/g, ' ').trim();
  const cities = [
    'JAKARTA',
    'JAKARTA BARAT',
    'JAKARTA TIMUR',
    'JAKARTA PUSAT',
    'JAKARTA SELATAN',
    'JAKARTA UTARA',
    'BOJONG SARI',
    'BREBES',
    'KEBUMEN',
    'BANYUMAS',
    'BONE',
    'MESSAWA',
    'WONODADI',
    'PONTIANAK',
    'TANGERANG',
    'BANJARMASIN',
    'DEPOK',
    'BEKASI',
    'BOGOR',
    'TANGERANG',
    'TANGERANG SELATAN',
    'SUKOHARJO',
    'SURAKARTA',
    'PEKANBARU',
    'RANAI',
    'NATUNA',
    'LAMPUNG',
    'LAMPUNG BARAT',
    'BANDAR LAMPUNG',
  ];
  if (up.startsWith('KOTA ')) return true;
  if (up.startsWith('KABUPATEN ')) return true;
  return cities.some((c) => up === c || up.endsWith(' ' + c));
}

function splitSekolahKotaText(text: string) {
  let t = text.replace(/\s+/g, ' ').trim();
  if (!t) return { sekolah: '', kota: '' };

  if (t.includes(',')) {
    const idx = t.lastIndexOf(',');
    const sekolah = t.slice(0, idx).trim();
    const kota = t.slice(idx + 1).trim();
    return { sekolah, kota };
  }

  const cityPhrases = [
    'LAMPUNG BARAT',
    'BANDAR LAMPUNG',
    'JAKARTA SELATAN',
    'JAKARTA UTARA',
    'JAKARTA PUSAT',
    'JAKARTA TIMUR',
    'JAKARTA BARAT',
    'JAKARTA',
    'DEPOK',
    'SUKOHARJO',
    'SURAKARTA',
    'PEKANBARU',
    'RANAI',
    'NATUNA',
    'LAMPUNG',
  ];

  const up = t.toUpperCase();
  for (const c of cityPhrases) {
    const idx = up.lastIndexOf(c);
    if (idx >= 0) {
      const sekolah = t.slice(0, idx).trim();
      const kota = t.slice(idx).trim();
      return { sekolah, kota };
    }
  }

  return { sekolah: t, kota: '' };
}

function extractNamaTempat(before: string) {
  let t = before.replace(/\s+/g, ' ').trim();
  if (!t) return { nama: '', tempat: '' };

  t = t.replace(/DAFTAR RIWAYAT HIDUP/gi, '').trim();
  t = t.replace(/PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA/gi, '').trim();
  t = t.replace(/\bpegawai\.jakarta\.go\.id\b/gi, '').trim();
  t = t.replace(/\bjakarta\.go\.id\b/gi, '').trim();
  t = t.replace(/Jalan Medan Merdeka Selatan No\.8-9/gi, '').trim();
  t = t.replace(/\bJAKARTA\b/gi, '').trim();

  const cityPhrases = [
    'LAMPUNG BARAT',
    'BANDAR LAMPUNG',
    'JAKARTA SELATAN',
    'JAKARTA UTARA',
    'JAKARTA PUSAT',
    'JAKARTA TIMUR',
    'JAKARTA BARAT',
    'JAKARTA',
    'DEPOK',
    'SUKOHARJO',
    'SURAKARTA',
    'PEKANBARU',
    'RANAI',
    'NATUNA',
    'LAMPUNG',
  ];

  const up = t.toUpperCase();
  for (const c of cityPhrases) {
    const idx = up.lastIndexOf(c);
    if (idx >= 0) {
      const nama = t.slice(0, idx).replace(/[,]+$/, '').trim();
      const tempat = t.slice(idx).replace(/[,]+$/, '').trim();
      return { nama, tempat };
    }
  }

  if (t.includes(',')) {
    const idx = t.lastIndexOf(',');
    const nama = t.slice(0, idx).trim();
    const tempat = t.slice(idx + 1).trim();
    return { nama, tempat };
  }

  // Filter out domain-like tokens
  const tokens = t.split(' ').filter((x) => !/\w+\.\w+/.test(x));
  const cleaned = tokens.join(' ').trim();
  return { nama: cleaned, tempat: '' };
}

function extractNamaTempatFromSeg(seg: string) {
  let t = seg.replace(/\s+/g, ' ').trim();
  if (!t) return { nama: '', tempat: '' };

  t = t.replace(/PERTAMA/gi, '').trim();
  t = t.replace(/SUAMI\/ISTERI\s+\d+/gi, '').trim();
  t = t.replace(/DAFTAR RIWAYAT HIDUP/gi, '').trim();
  t = t.replace(/PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA/gi, '').trim();
  t = t.replace(/\bpegawai\.jakarta\.go\.id\b/gi, '').trim();

  const cityPhrases = [
    'LAMPUNG BARAT',
    'BANDAR LAMPUNG',
    'JAKARTA SELATAN',
    'JAKARTA UTARA',
    'JAKARTA PUSAT',
    'JAKARTA TIMUR',
    'JAKARTA BARAT',
    'JAKARTA',
    'DEPOK',
    'SUKOHARJO',
    'SURAKARTA',
    'PEKANBARU',
    'RANAI',
    'NATUNA',
    'LAMPUNG',
    'BANYUMAS',
    'KEBUMEN',
    'BONE',
    'MESSAWA',
    'WONODADI',
    'PONTIANAK',
    'TANGERANG',
    'BANJARMASIN',
    'BREBES',
  ];

  const up = t.toUpperCase();
  for (const c of cityPhrases) {
    const idx = up.lastIndexOf(c);
    if (idx >= 0) {
      const nama = t.slice(0, idx).replace(/[,]+$/, '').trim();
      const tempat = t.slice(idx, idx + c.length).replace(/[,]+$/, '').trim();
      return { nama, tempat };
    }
  }

  if (t.includes(',')) {
    const idx = t.lastIndexOf(',');
    const left = t.slice(0, idx).trim();
    const right = t.slice(idx + 1).trim();
    const parts = left.split(' ');
    if (parts.length >= 2) {
      const tempat = parts[parts.length - 1].trim();
      const nama = parts.slice(0, parts.length - 1).join(' ').trim();
      return { nama, tempat: tempat || right };
    }
  }

  return { nama: t, tempat: '' };
}

function isOnlyNumber(s: string) {
  return /^\d+$/.test(s);
}

function parseFormalBlock(block: string): PFRow[] {
  const raw = block.replace(/\s+/g, ' ').trim();
  if (!raw || /TIDAK ADA DATA/i.test(raw)) return [];

  const rows: PFRow[] = [];
  const re = /(\d+)\s+(SD|SMP|SMA|SMK|D3|D-3|D4|S1|S2|S3)\s+([\s\S]*?)(?=\s+\d+\s+(SD|SMP|SMA|SMK|D3|D-3|D4|S1|S2|S3)\s+|$)/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(raw))) {
    const tingkatRaw = m[2];
    let seg = m[3].trim();

    const dateMatch = seg.match(/\d{2}-\d{2}-\d{4}/);
    if (!dateMatch) continue;

    const tgl = dateMatch[0];
    const idxDate = seg.indexOf(tgl);
    const before = seg.slice(0, idxDate).trim();
    const after = seg.slice(idxDate + tgl.length).trim();

    const jurusan = before.replace(/\bJURUSAN\b/i, '').trim();
    const { sekolah, kota } = splitSekolahKotaText(after);

    rows.push({
      tingkat: tingkatRaw.replace(/[- ]/g, ''),
      jurusan,
      tgl_ijazah: dmyToYmd(tgl),
      nama_sekolah: sekolah,
      kota,
    });

    if (rows.length >= 5) break;
  }

  if (rows.length) return rows;

  // Fallback: columnar layout (levels listed first, then dates+schools+cities)
  const lines = cleanLines(block).filter(
    (l) =>
      !/RIWAYAT/i.test(l) &&
      !/^NO\b/i.test(l) &&
      !/JURUSAN|TINGKAT|TGL|NAMA|KOTA|PENDIDIKAN|SEKOLAH/i.test(l)
  );

  const tingkatList: string[] = [];
  const jurusanList: string[] = [];
  const dateList: string[] = [];
  const sekolahList: string[] = [];
  const kotaList: string[] = [];

  let pendingJurusan = '';
  for (const l of lines) {
    if (isOnlyNumber(l)) continue;
    if (isDateDMY(l)) {
      dateList.push(l);
      continue;
    }

    const up = l.toUpperCase();
    const mLevel = up.match(/^(SD|SMP|SMA|SMK|D[- ]?3|D[- ]?4|S1|S2|S3)\b(.*)$/);
    if (mLevel) {
      const lvl = mLevel[1].replace(/[- ]/g, '');
      tingkatList.push(lvl);
      const jur = (mLevel[2] || '').trim();
      if (jur) jurusanList.push(jur);
      continue;
    }

    if (/^D-?\d|^S-\d/i.test(l)) {
      pendingJurusan = (pendingJurusan ? pendingJurusan + ' ' : '') + l;
      continue;
    }

    if (pendingJurusan && !isKnownCityLine(l) && !isDateDMY(l)) {
      jurusanList.push((pendingJurusan + ' ' + l).trim());
      pendingJurusan = '';
      continue;
    }

    if (isKnownCityLine(l) || isUpperCityLine(l)) {
      kotaList.push(l);
      continue;
    }

    sekolahList.push(l.replace(/\s*,\s*$/g, ''));
  }

  const out: PFRow[] = [];
  const n = Math.min(5, Math.max(tingkatList.length, dateList.length, sekolahList.length));
  for (let i = 0; i < n; i++) {
    out.push({
      tingkat: tingkatList[i] || '',
      jurusan: (jurusanList[i] || '').trim(),
      tgl_ijazah: dateList[i] ? dmyToYmd(dateList[i]) : '',
      nama_sekolah: (sekolahList[i] || '').trim(),
      kota: (kotaList[i] || '').trim(),
    });
  }
  return out;
}

function parseNonFormalBlock(block: string): PNRow[] {
  const lines = cleanLines(block).filter((l) => !/RIWAYAT|NO\b|TGL|NAMA|KOTA/i.test(l));
  if (lines.some((l) => /TIDAK ADA DATA/i.test(l))) return [];
  const rows: PNRow[] = [];
  let cur: PNRow | null = null;

  for (const l of lines) {
    if (isOnlyNumber(l)) continue;
    if (isDateDMY(l)) {
      if (cur) rows.push(cur);
      cur = { tgl_ijazah: dmyToYmd(l), nama_sekolah: '', kota: '' };
      continue;
    }
    if (!cur) continue;
    if (!cur.nama_sekolah) {
      cur.nama_sekolah = l;
      continue;
    }
    if (!cur.kota) {
      cur.kota = l;
      continue;
    }
  }
  if (cur) rows.push(cur);
  return rows.slice(0, 5);
}

function parseKeluargaBlock(block: string): KeluargaRow[] {
  const raw = block.replace(/\s+/g, ' ').trim();
  if (!raw) return [];

  const cleaned = raw
    .replace(/RIWAYAT KELUARGA/i, '')
    .replace(/NO HUBUNGAN NAMA TTL JENIS KELAMIN TUNJANGAN PEKERJAAN/i, '')
    .replace(/\bpegawai\.jakarta\.go\.id\b/gi, '')
    .trim();

  const rowsByRegex: KeluargaRow[] = [];
  const re = /(\d+)\s+(SUAMI\s*\/\s*ISTERI|ANAK\s+\d+\s+DR)\s+([\s\S]*?)(?=\s+\d+\s+(SUAMI\s*\/\s*ISTERI|ANAK\s+\d+\s+DR)\s+|$)/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(cleaned))) {
    const hubungan = m[2].replace(/\s+/g, ' ').toUpperCase();
    let seg = m[3].trim();

    const dateMatch = seg.match(/\d{2}-\d{2}-\d{4}/g);
    const tgl = dateMatch && dateMatch.length ? dateMatch[dateMatch.length - 1] : '';

    let jk = '';
    if (/LAKI-LAKI/i.test(seg)) jk = 'L';
    if (/PEREMPUAN/i.test(seg)) jk = 'P';

    const tunj = /DAPAT/i.test(seg) ? 1 : 0;
    let pekerjaan = '';
    if (/ASN\(CPNS\/PNS\/PPPK\)/i.test(seg)) pekerjaan = 'ASN(CPNS/PNS/PPPK)';
    else if (/PELAJAR\/MAHASISWA/i.test(seg)) pekerjaan = 'PELAJAR/MAHASISWA';
    else if (/TIDAK BEKERJA/i.test(seg)) pekerjaan = 'TIDAK BEKERJA';
    else if (/SWASTA/i.test(seg)) pekerjaan = 'SWASTA';
    else if (/BUMN/i.test(seg)) pekerjaan = 'BUMN';

    let before = seg;
    if (tgl) before = seg.split(tgl)[0].trim();
    before = before
      .replace(/LAKI-LAKI|PEREMPUAN|DAPAT|TIDAK BEKERJA|ASN\(CPNS\/PNS\/PPPK\)|PELAJAR\/MAHASISWA/gi, '')
      .trim();

    const np = extractNamaTempatFromSeg(before);

    rowsByRegex.push({
      hubungan,
      nama: np.nama,
      tempat_lahir: np.tempat,
      tanggal_lahir: tgl ? dmyToYmd(tgl) : '',
      jenis_kelamin: jk,
      tunjangan: tunj,
      pekerjaan,
    });

    if (rowsByRegex.length >= 6) break;
  }

  if (rowsByRegex.length) return rowsByRegex;

  const lines = cleanLines(block).filter(
    (l) =>
      l &&
      !/RIWAYAT KELUARGA/i.test(l) &&
      !/NO HUBUNGAN NAMA TTL JENIS KELAMIN TUNJANGAN PEKERJAAN/i.test(l) &&
      !/DAFTAR RIWAYAT HIDUP/i.test(l) &&
      !/PEMERINTAH PROVINSI/i.test(l) &&
      !/pegawai\.jakarta\.go\.id/i.test(l)
  );

  const rows: KeluargaRow[] = [];
  let cur: KeluargaRow | null = null;

  const flush = () => {
    if (cur) rows.push(cur);
    cur = null;
  };

  for (const l of lines) {
    if (isOnlyNumber(l)) continue;
    if (/^(SUAMI\s*\/\s*ISTERI|ANAK\s+\d+\s+DR)/i.test(l)) {
      flush();
      cur = {
        hubungan: l.replace(/\s+/g, ' ').toUpperCase(),
        nama: '',
        tempat_lahir: '',
        tanggal_lahir: '',
        jenis_kelamin: '',
        tunjangan: 0,
        pekerjaan: '',
      };
      continue;
    }
    if (!cur) continue;

    if (/^SUAMI\/ISTERI\s+\d+/i.test(l) || /\bPERTAMA\b/i.test(l)) continue;

    if (isDateDMY(l)) {
      cur.tanggal_lahir = dmyToYmd(l);
      continue;
    }
    if (/LAKI-LAKI/i.test(l)) cur.jenis_kelamin = 'L';
    if (/PEREMPUAN/i.test(l)) cur.jenis_kelamin = 'P';
    if (/DAPAT/i.test(l)) cur.tunjangan = 1;
    if (/ASN\(CPNS\/PNS\/PPPK\)/i.test(l)) cur.pekerjaan = 'ASN(CPNS/PNS/PPPK)';
    else if (/PELAJAR\/MAHASISWA/i.test(l)) cur.pekerjaan = 'PELAJAR/MAHASISWA';
    else if (/TIDAK BEKERJA/i.test(l)) cur.pekerjaan = 'TIDAK BEKERJA';
    else if (/SWASTA/i.test(l)) cur.pekerjaan = 'SWASTA';
    else if (/BUMN/i.test(l)) cur.pekerjaan = 'BUMN';

    if ((/,/.test(l) || isKnownCityLine(l)) && !cur.tempat_lahir) {
      cur.tempat_lahir = l.replace(/,/, '').trim();
      continue;
    }

    if (!cur.nama && !/LAKI-LAKI|PEREMPUAN|DAPAT|TIDAK/i.test(l) && !/\d{2}-\d{2}-\d{4}/.test(l)) {
      cur.nama = l.replace(/\s+/g, ' ').trim();
      continue;
    } else if (cur.nama && !cur.tempat_lahir && !/LAKI-LAKI|PEREMPUAN|DAPAT|TIDAK/i.test(l)) {
      // name continuation
      cur.nama = (cur.nama + ' ' + l).trim();
    }
  }
  flush();
  return rows.slice(0, 6);
}

function parseJabatanBlock(block: string, jenis: string): JabRow[] {
  const buildJabatanRows = (blk: string) => {
    const lines = blk
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length);
    const rows: string[] = [];
    let cur = '';
    for (const line of lines) {
      if (/^NO\b/i.test(line)) continue;
      const startRow = line.match(/^(\d+)\s+(\d{2}-\d{2}-\d{4})\b(.*)$/);
      if (startRow) {
        if (cur) rows.push(cur.trim());
        cur = `${startRow[2]} ${startRow[3].trim()}`;
        continue;
      }
      if (cur) {
        cur += ' ' + line;
      }
    }
    if (cur) rows.push(cur.trim());
    return rows;
  };

  const blockRows = buildJabatanRows(block);
  const rows: JabRow[] = [];

  const pangkatKey = ['JURU', 'PENGATUR', 'PENATA', 'PEMBINA'];
  const jabKey = [
    'STAF',
    'KEPALA',
    'KASIE',
    'KASI',
    'KASUBBAG',
    'PRANATA',
    'PERAWAT',
    'DOKTER',
    'APOTEKER',
    'TEKNIS',
    'TEKNISI',
    'ADMINISTRASI',
    'PELAKSANA',
    'ANALIS',
    'PENGAWAS',
  ];
  const isLikelyLocation = (value: string) => {
    const v = value.toUpperCase();
    return (
      v.includes('KABUPATEN') ||
      v.includes('KOTA ') ||
      v.includes('RUMAH SAKIT') ||
      v.includes('RSUD') ||
      v.includes('DINAS') ||
      v.includes('PUSKESMAS') ||
      v.includes('UPT') ||
      v.includes('BIRO') ||
      v.includes('BADAN') ||
      v.includes('SUKU') ||
      v.includes('UNIT')
    );
  };
  const isPangkatTail = (tok: string) => {
    const t = tok.toUpperCase().replace(/[()]/g, '');
    if (/^[IV]{1,3}\/[A-E]$/.test(t)) return true;
    if (/^TK\.?I{1,3}$/.test(t.replace(/\./g, ''))) return true;
    return false;
  };

  const parseRow = (row: string): JabRow | null => {
    const tmtMatch = row.match(/\d{2}-\d{2}-\d{4}/);
    if (!tmtMatch) return null;
    const tmt = tmtMatch[0];
    let tailStr = row.slice(row.indexOf(tmt) + tmt.length).trim();
    if (!tailStr) return null;

    const tglSkMatches = tailStr.match(/\d{2}-\d{2}-\d{4}/g) || [];
    const tgl_sk = tglSkMatches.length ? tglSkMatches[tglSkMatches.length - 1] : '';
    const preTgl = tgl_sk ? tailStr.slice(0, tailStr.lastIndexOf(tgl_sk)).trim() : tailStr;

    let eselon = '';
    let no_sk = '';
    let preEselon = preTgl;
    const eselonMatch = preTgl.match(/(.*)\b(\d{2})\b([\s\S]*)$/);
    if (eselonMatch) {
      preEselon = eselonMatch[1].trim();
      eselon = eselonMatch[2];
      no_sk = eselonMatch[3].trim();
    } else {
      const noSkMatch = preTgl.match(/(.*)\b(\d{2,}[^\d].*)$/);
      if (noSkMatch) {
        preEselon = noSkMatch[1].trim();
        no_sk = noSkMatch[2].trim();
      }
    }

    let idxPang = -1;
    const tokens = preEselon.split(/\s+/).filter(Boolean);
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (pangkatKey.includes(tokens[i].toUpperCase())) {
        idxPang = i;
        break;
      }
    }
    if (idxPang < 0) return null;

    let idxEsel = -1;
    let idxNoSkStart = -1;
    for (let i = idxPang + 1; i < tokens.length; i++) {
      const tok = tokens[i];
      if (isDateDMY(tok)) break;
      if (idxEsel < 0 && /^\d{2}$/.test(tok)) {
        idxEsel = i;
        idxNoSkStart = i + 1;
        break;
      }
    }
    if (idxNoSkStart < 0) {
      for (let i = idxPang + 1; i < tokens.length; i++) {
        const tok = tokens[i];
        if (isDateDMY(tok)) break;
        if (/\d/.test(tok) && !isPangkatTail(tok)) {
          idxNoSkStart = i;
          break;
        }
      }
    }

    const pangkatEnd = idxNoSkStart >= 0 ? idxNoSkStart : tokens.length;
    const jabLocTokens = tokens.slice(0, idxPang);
    const pangkatTokens = tokens.slice(idxPang, pangkatEnd);

    let idxJab = -1;
    for (let i = 0; i < jabLocTokens.length; i++) {
      if (jabKey.includes(jabLocTokens[i].toUpperCase())) {
        idxJab = i;
        break;
      }
    }

    let lokasi = idxJab >= 0 ? jabLocTokens.slice(0, idxJab).join(' ') : jabLocTokens.join(' ');
    let jabatan = idxJab >= 0 ? jabLocTokens.slice(idxJab).join(' ') : '';

    const jabatanTokens = jabatan.split(/\s+/).filter(Boolean);
    const idxJab2 = jabatanTokens.findIndex((tok) => jabKey.includes(tok.toUpperCase()));
    if (idxJab2 > 0) {
      const beforeJab = jabatanTokens.slice(0, idxJab2).join(' ');
      const afterJab = jabatanTokens.slice(idxJab2).join(' ');
      if (isLikelyLocation(beforeJab)) {
        lokasi = `${lokasi} ${beforeJab}`.trim();
        jabatan = afterJab.trim();
      }
    }

    const jabatanHasKey = jabKey.some((k) => jabatan.toUpperCase().includes(k));
    if (jabatan && !jabatanHasKey && isLikelyLocation(jabatan)) {
      lokasi = `${lokasi} ${jabatan}`.trim();
      jabatan = '';
    }

    const no_sk_tokens = idxNoSkStart >= 0 ? tokens.slice(idxNoSkStart) : [];

    return {
      jenis,
      tmt: dmyToYmd(tmt),
      lokasi: lokasi.trim(),
      jabatan: jabatan.trim(),
      pangkat: pangkatTokens.join(' ').trim(),
      eselon: idxEsel >= 0 ? tokens[idxEsel] : eselon,
      no_sk: no_sk_tokens.join(' ').trim() || no_sk,
      tgl_sk: tgl_sk ? dmyToYmd(tgl_sk) : '',
    };
  };

  if (blockRows.length) {
    for (const row of blockRows) {
      const parsed = parseRow(row);
      if (parsed && parsed.tmt && (parsed.jabatan || parsed.lokasi)) {
        rows.push(parsed);
      }
      if (rows.length >= 10) break;
    }
    if (rows.length) return rows;
  }

  const lines = cleanLines(block).filter(
    (l) => !/RIWAYAT|NO\b|TMT|LOKASI|JABATAN|PANGKAT|ESL|NO\.SK|TGL\.SK/i.test(l)
  );
  let cur: JabRow | null = null;
  for (const l of lines) {
    if (isOnlyNumber(l)) continue;
    if (isDateDMY(l)) {
      if (cur && cur.tmt && cur.jabatan) {
        rows.push(cur);
        cur = null;
      }
      if (!cur) {
        cur = { jenis, tmt: dmyToYmd(l), lokasi: '', jabatan: '', pangkat: '', eselon: '', no_sk: '', tgl_sk: '' };
      } else if (!cur.tgl_sk) {
        cur.tgl_sk = dmyToYmd(l);
      }
      continue;
    }
    if (!cur) continue;

    if (/^\d{2}$/.test(l) && !cur.eselon) {
      cur.eselon = l;
      continue;
    }
    if (/JURU|PENGATUR|PENATA|PEMBINA/i.test(l) && !cur.pangkat) {
      cur.pangkat = l;
      continue;
    }
    if (/STAF|KEPALA|KASIE|KASI|KASUBBAG|PRANATA|PERAWAT|DOKTER|APOTEKER|TEKNISI|ADMINISTRASI|PELAKSANA/i.test(l) && !cur.jabatan) {
      cur.jabatan = l;
      continue;
    }
    if (/TAHUN|\//i.test(l) && !cur.no_sk && /\d/.test(l)) {
      cur.no_sk = l;
      continue;
    }
    if (!cur.lokasi && /DINAS|PUSKESMAS|RUMAH|RSUD|UPT|BIRO|BADAN|KANTOR|SUKU|UNIT|KABUPATEN|KOTA/i.test(l)) {
      cur.lokasi = l;
      continue;
    }
    if (!cur.jabatan && cur.lokasi && !cur.no_sk) {
      cur.jabatan = l;
      continue;
    }
  }

  if (cur && cur.tmt && cur.jabatan) rows.push(cur);
  return rows.slice(0, 10);
}

function parsePangkatBlock(block: string): PangkatRow[] {
  const lines = cleanLines(block).filter((l) => !/RIWAYAT|NO\b|TMT|PANGKAT|LOKASI|NO\.SK|TGL\.SK/i.test(l));
  const rows: PangkatRow[] = [];
  let cur: PangkatRow | null = null;

  for (const l of lines) {
    if (isOnlyNumber(l)) continue;
    if (isDateDMY(l)) {
      if (cur && cur.tmt && cur.pangkat) {
        rows.push(cur);
        cur = null;
      }
      if (!cur) {
        cur = { tmt: dmyToYmd(l), pangkat: '', lokasi: '', no_sk: '', tgl_sk: '' };
      } else if (!cur.tgl_sk) {
        cur.tgl_sk = dmyToYmd(l);
      }
      continue;
    }
    if (!cur) continue;
    if (/JURU|PENGATUR|PENATA|PEMBINA/i.test(l) && !cur.pangkat) {
      cur.pangkat = l;
      continue;
    }
    if (!cur.lokasi && /DINAS|PUSKESMAS|RUMAH|RSUD|UPT|BIRO|BADAN|KANTOR|SUKU|UNIT/i.test(l)) {
      cur.lokasi = l;
      continue;
    }
    if (/TAHUN|\//i.test(l) && !cur.no_sk && /\d/.test(l)) {
      cur.no_sk = l;
      continue;
    }
  }
  if (cur && cur.tmt && cur.pangkat) rows.push(cur);
  return rows.slice(0, 10);
}

function parseGajiBlock(block: string): GajiRow[] {
  const lines = cleanLines(block).filter((l) => !/RIWAYAT|NO\b|TMT|PANGKAT|GAJI|NO\.SK|TGL\.SK/i.test(l));
  const rows: GajiRow[] = [];
  let cur: GajiRow | null = null;

  for (const l of lines) {
    if (isOnlyNumber(l)) continue;
    if (isDateDMY(l)) {
      if (cur && cur.tmt && cur.gaji && !cur.tgl_sk) {
        cur.tgl_sk = dmyToYmd(l);
        continue;
      }
      if (cur && cur.tmt) rows.push(cur);
      cur = { tmt: dmyToYmd(l), pangkat: '', gaji: '', no_sk: '', tgl_sk: '' };
      continue;
    }
    if (!cur) continue;
    if (/JURU|PENGATUR|PENATA|PEMBINA/i.test(l) && !cur.pangkat) {
      cur.pangkat = l;
      continue;
    }
    if (!cur.gaji && /\d[.,]\d/.test(l)) {
      cur.gaji = l;
      continue;
    }
    if (/TAHUN|\//i.test(l) && !cur.no_sk && /\d/.test(l)) {
      cur.no_sk = l;
      continue;
    }
    if (isDateDMY(l) && !cur.tgl_sk) {
      cur.tgl_sk = dmyToYmd(l);
      continue;
    }
  }
  if (cur && cur.tmt) rows.push(cur);
  return rows.slice(0, 10);
}

async function extractPdfText(file: File): Promise<string> {
  // @ts-ignore
  const pdfjsLib = typeof window !== 'undefined' ? window.pdfjsLib : null;
  if (!pdfjsLib) throw new Error('PDF.js belum siap. Tunggu 1-2 detik lalu coba lagi.');

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  let full = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((it: any) => it.str);
    full += strings.join('\n') + '\n';
  }
  return full;
}

function parseJabRow(row: string, jenisDefault: string): JabRow | null {
  const tokens = row.split(/\s+/);
  if (!tokens.length) return null;

  const tmt = tokens[0];
  const tAfter = tokens.slice(1);
  if (!tAfter.length) return null;

  let idxEsel = -1;
  for (let i = tAfter.length - 1; i >= 0; i--) {
    if (/^\d{2}$/.test(tAfter[i])) {
      idxEsel = i;
      break;
    }
  }

  let eselon = '';
  let noSk = '';
  let tglSk = '';
  let pangkat = '';
  let lokasi = '';
  let jabatan = '';

  for (let i = tAfter.length - 1; i >= 0; i--) {
    if (/^\d{2}-\d{2}-\d{4}$/.test(tAfter[i])) {
      tglSk = tAfter[i];
      if (idxEsel >= 0 && i > idxEsel + 1) {
        noSk = tAfter.slice(idxEsel + 1, i).join(' ');
      }
      break;
    }
  }
  if (idxEsel >= 0) eselon = tAfter[idxEsel];

  const pangkatKey = ['JURU', 'PENGATUR', 'PENATA', 'PEMBINA'];
  let idxPang = -1;
  for (let i = 0; i < tAfter.length; i++) {
    if (pangkatKey.includes(tAfter[i].toUpperCase())) {
      idxPang = i;
      break;
    }
  }

  if (idxPang >= 0) {
    const endP = idxEsel >= 0 ? idxEsel : tAfter.length;
    pangkat = tAfter.slice(idxPang, endP).join(' ');
    const beforeP = tAfter.slice(0, idxPang);

    const jabKey = ['STAF', 'KEPALA', 'KASIE', 'KASI', 'KASUBBAG', 'PRANATA', 'PERAWAT', 'DOKTER', 'APOTEKER'];
    let idxJab = -1;
    for (let i = 0; i < beforeP.length; i++) {
      if (jabKey.includes(beforeP[i].toUpperCase())) {
        idxJab = i;
        break;
      }
    }
    if (idxJab >= 0) {
      lokasi = beforeP.slice(0, idxJab).join(' ');
      jabatan = beforeP.slice(idxJab).join(' ');
    } else {
      lokasi = beforeP.join(' ');
    }
  }

  return {
    jenis: jenisDefault,
    tmt: dmyToYmd(tmt),
    lokasi: lokasi.trim(),
    jabatan: jabatan.trim(),
    pangkat: pangkat.trim(),
    eselon: eselon.trim(),
    no_sk: noSk.trim(),
    tgl_sk: dmyToYmd(tglSk),
  };
}

const ImportDRHPage = () => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'upload' | 'form'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [rawText, setRawText] = useState('');

  // Form data - Diri
  const [nip, setNip] = useState('');
  const [nrk, setNrk] = useState('');
  const [nik, setNik] = useState('');
  const [nama, setNama] = useState('');
  const [tempatLahir, setTempatLahir] = useState('');
  const [tglLahir, setTglLahir] = useState('');
  const [jk, setJk] = useState('');
  const [agama, setAgama] = useState('');
  const [email, setEmail] = useState('');
  const [noHp, setNoHp] = useState('');
  const [statusPerkawinan, setStatusPerkawinan] = useState('');
  const [statusRumpun, setStatusRumpun] = useState('');

  // Form data - Alamat
  const [alamatJalan, setAlamatJalan] = useState('');
  const [alamatRt, setAlamatRt] = useState('');
  const [alamatRw, setAlamatRw] = useState('');
  const [alamatKel, setAlamatKel] = useState('');
  const [alamatKec, setAlamatKec] = useState('');
  const [alamatKota, setAlamatKota] = useState('');
  const [alamatProv, setAlamatProv] = useState('DKI JAKARTA');

  // Form data - Pendidikan
  const [pf, setPf] = useState<PFRow[]>(
    Array.from({ length: 5 }).map(() => ({
      tingkat: '',
      jurusan: '',
      tgl_ijazah: '',
      nama_sekolah: '',
      kota: '',
    }))
  );

  const [pn, setPn] = useState<PNRow[]>(
    Array.from({ length: 5 }).map(() => ({
      tgl_ijazah: '',
      nama_sekolah: '',
      kota: '',
    }))
  );

  // Form data - Riwayat
  const [rJabatan, setRJabatan] = useState<JabRow[]>(
    Array.from({ length: 10 }).map(() => ({
      jenis: '',
      tmt: '',
      lokasi: '',
      jabatan: '',
      pangkat: '',
      eselon: '',
      no_sk: '',
      tgl_sk: '',
    }))
  );

  const [rPangkat, setRPangkat] = useState<PangkatRow[]>(
    Array.from({ length: 10 }).map(() => ({
      tmt: '',
      pangkat: '',
      lokasi: '',
      no_sk: '',
      tgl_sk: '',
    }))
  );

  const [rGaji, setRGaji] = useState<GajiRow[]>(
    Array.from({ length: 10 }).map(() => ({
      tmt: '',
      pangkat: '',
      gaji: '',
      no_sk: '',
      tgl_sk: '',
    }))
  );

  const [keluarga, setKeluarga] = useState<KeluargaRow[]>(
    Array.from({ length: 6 }).map(() => ({
      hubungan: '',
      nama: '',
      tempat_lahir: '',
      tanggal_lahir: '',
      jenis_kelamin: '',
      tunjangan: 0,
      pekerjaan: '',
    }))
  );

  const canSave = useMemo(() => {
    const anyId = nip.trim() || nrk.trim() || nik.trim();
    return Boolean(anyId && nama.trim());
  }, [nip, nrk, nik, nama]);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/');
      return;
    }
    setUser(storedUser);
  }, [router]);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    const toast: Toast = { id, type, message };
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      addToast(`File ${file.name} dipilih`);
    }
  };

  const parseDrhText = (text: string) => {
    // DATA DIRI
    const namaX = getFirstMatch(/NAMA\s*:?\s*([^\n]+)/i, text);
    if (namaX) setNama(namaX);

    const nrkNip = text.match(/NRK\s*\/\s*NIP\s*:?\s*([\d ]+)\s*\/\s*([\d ]+)/i);
    if (nrkNip) {
      const nrkV = (nrkNip[1] || '').replace(/\s+/g, '');
      const nipV = (nrkNip[2] || '').replace(/\s+/g, '');
      setNrk(nrkV);
      setNip(nipV);
      setNik(nipV);
    }

    const ttl = text.match(/TEMPAT\s*\/\s*TGL\s*LAHIR\s*:?\s*([A-Z .]+)\s*\/\s*([0-9]{2}-[0-9]{2}-[0-9]{4})/i);
    if (ttl) {
      setTempatLahir((ttl[1] || '').trim());
      setTglLahir(dmyToYmd(ttl[2]));
    }

    const agamaX = getFirstMatch(/AGAMA\s*:?\s*([A-Z ]+)/i, text);
    if (agamaX) setAgama(agamaX.trim());

    const jkX = getFirstMatch(/JENIS\s*KELAMIN\s*:?\s*([A-Z \-]+)/i, text).toUpperCase();
    if (jkX.includes('LAKI')) setJk('L');
    else if (jkX.includes('PEREM')) setJk('P');

    const statNikah = getFirstMatch(/STATUS\s+PERNIKAHAN[: ]+\s*([A-Z0-9 \/]+)/i, text);
    if (statNikah) {
      const up = statNikah.toUpperCase();
      if (up.includes('KAWIN') || up.includes('MENIKAH')) setStatusPerkawinan('MENIKAH');
      else if (up.includes('BELUM')) setStatusPerkawinan('BELUM MENIKAH');
      else if (up.includes('CERAI')) setStatusPerkawinan('CERAI');
    }

    const hpBlock = text.match(/NO\.\s*TELEPON\s*\/\s*HP([\s\S]*?)EMAIL/i);
    if (hpBlock) {
      const digits = hpBlock[0].match(/\d{8,16}/g);
      if (digits?.length) setNoHp(digits[digits.length - 1]);
    }

    const emailX = getFirstMatch(/EMAIL\s*:?\s*([^\s\n]+)/i, text);
    if (emailX) setEmail(emailX);
    else {
      const emailAny = findEmail(text);
      if (emailAny) setEmail(emailAny);
    }

    // ALAMAT
    const alamatLine = getFirstMatch(/ALAMAT\s*:?\s*([^\n]+)/i, text);
    if (alamatLine) {
      if (!/@/.test(alamatLine)) {
        setAlamatJalan(alamatLine);
      } else {
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const idx = lines.findIndex((l) => /^ALAMAT/i.test(l));
        if (idx >= 0) {
          const next = lines.slice(idx + 1).find((l) => l && !/@/.test(l));
          if (next) setAlamatJalan(next.replace(/^:\s*/, ''));
        }
      }
    }

    const rtRw = text.match(/RT\/RW[: ]+([0-9]+)\s*\/\s*([0-9]+)/i);
    if (rtRw) {
      setAlamatRt(rtRw[1]);
      setAlamatRw(rtRw[2]);
    }

    const kelX = getFirstMatch(/KELURAHAN\s+([A-Z .]+)/i, text);
    if (kelX) setAlamatKel(kelX);

    const kecX = getFirstMatch(/KECAMATAN\s+([A-Z .]+)/i, text);
    if (kecX) setAlamatKec(kecX);

    const linesAddr = text
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const kotaProvLine =
      linesAddr.find((l) => /KOTA\s+ADMINISTRASI/i.test(l) && /-/.test(l)) ||
      linesAddr.find((l) => /KOTA\s+/i.test(l) && /-/.test(l)) ||
      linesAddr.find((l) => /KABUPATEN\s+/i.test(l) && /-/.test(l));

    if (kotaProvLine) {
      const parts = kotaProvLine.split('-').map((p) => p.trim());
      const left = parts[0] || '';
      const right = parts[1] || '';
      const kotaVal = left.replace(/\s{2,}/g, ' ').trim();
      if (kotaVal) setAlamatKota(kotaVal);
      if (right) setAlamatProv(right);
    } else {
      const kotaOnly =
        linesAddr.find((l) => /^KOTA\s+ADMINISTRASI\b/i.test(l)) ||
        linesAddr.find((l) => /^KOTA\b/i.test(l)) ||
        linesAddr.find((l) => /^KABUPATEN\b/i.test(l));
      if (kotaOnly) setAlamatKota(kotaOnly.replace(/\s{2,}/g, ' ').trim());
    }

    // PENDIDIKAN FORMAL
    const blockFormal = getBlock(text, /RIWAYAT PENDIDIKAN FORMAL/i, /RIWAYAT PENDIDIKAN NON FORMAL/i);
    const pfNew = parseFormalBlock(blockFormal);
    if (pfNew.length) {
      setPf((prev) => prev.map((r, i) => pfNew[i] || r));
    }

    // PENDIDIKAN NON FORMAL
    const blockNon = getBlock(text, /RIWAYAT PENDIDIKAN NON FORMAL/i, /RIWAYAT KELUARGA|RIWAYAT JABATAN STRUKTURAL/i);
    const pnNew = parseNonFormalBlock(blockNon);
    if (pnNew.length) {
      setPn((prev) => prev.map((r, i) => pnNew[i] || r));
    }

    // RIWAYAT KELUARGA
    const blockKel = getBlock(text, /RIWAYAT KELUARGA/i, /RIWAYAT JABATAN STRUKTURAL/i);
    const kelNew = parseKeluargaBlock(blockKel);
    if (kelNew.length) {
      setKeluarga((prev) => prev.map((r, i) => kelNew[i] || r));
    }

    // RIWAYAT JABATAN
    const blockJabStr = getBlock(text, /RIWAYAT JABATAN STRUKTURAL/i, /RIWAYAT JABATAN FUNGSIONAL/i);
    const blockJabFun = getBlock(text, /RIWAYAT JABATAN FUNGSIONAL/i, /RIWAYAT GAJI POKOK/i);
    const jabStr = parseJabatanBlock(blockJabStr, 'STR');
    const jabFun = parseJabatanBlock(blockJabFun, 'FUN');
    const jabNew = [...jabStr, ...jabFun].slice(0, 10).map((r) => ({
      ...r,
      jenis: normalisasiJenisJabatan(r.jenis) || r.jenis,
    }));
    if (jabNew.length) {
      setRJabatan((prev) => prev.map((r, i) => jabNew[i] || r));
    }

    // RIWAYAT GAJI
    const blockGaji = getBlock(text, /RIWAYAT GAJI POKOK/i, /RIWAYAT PANGKAT/i);
    const gajiNew = parseGajiBlock(blockGaji);
    if (gajiNew.length) {
      setRGaji((prev) => prev.map((r, i) => gajiNew[i] || r));
    }

    // RIWAYAT PANGKAT
    const blockPangkat = getBlock(text, /RIWAYAT PANGKAT/i, /RIWAYAT PENGHARGAAN|RIWAYAT DP3|RIWAYAT SKP|RIWAYAT HUKUMAN|$/i);
    const pangkatNew = parsePangkatBlock(blockPangkat);
    if (pangkatNew.length) {
      setRPangkat((prev) => prev.map((r, i) => pangkatNew[i] || r));
    }
  };

  const handleExtract = async () => {
    if (!selectedFile) {
      addToast('Pilih file PDF terlebih dahulu', 'error');
      return;
    }

    setIsExtracting(true);
    try {
      const txt = await extractPdfText(selectedFile);
      setRawText(txt);
      parseDrhText(txt);
      addToast('File PDF berhasil diekstraksi');
      setActiveTab('form');
    } catch (error: any) {
      addToast('Gagal mengekstraksi PDF: ' + error.message, 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) {
      addToast('Minimal isi NIP/NRK/NIK dan Nama dulu', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const namaUkpd = user?.nama_ukpd || '';
      const payload = {
        nip,
        nrk,
        nik,
        nama,
        nama_ukpd: namaUkpd,
        tempat_lahir: tempatLahir,
        tanggal_lahir: tglLahir,
        agama,
        jenis_kelamin: jk,
        status_perkawinan: statusPerkawinan,
        status_rumpun: statusRumpun,
        no_hp: noHp,
        email,
        alamat_jalan: alamatJalan,
        alamat_rt: alamatRt,
        alamat_rw: alamatRw,
        alamat_kelurahan: alamatKel,
        alamat_kecamatan: alamatKec,
        alamat_kota: alamatKota,
        alamat_provinsi: alamatProv,
        pendidikan_formal: pf.filter((r) => r.tingkat || r.nama_sekolah || r.tgl_ijazah),
        pendidikan_nonformal: pn.filter((r) => r.tgl_ijazah || r.nama_sekolah || r.kota),
        riwayat_jabatan: rJabatan.filter((r) => r.tmt || r.jabatan),
        riwayat_pangkat: rPangkat.filter((r) => r.tmt || r.pangkat),
        riwayat_gaji: rGaji.filter((r) => r.tmt || r.gaji),
        keluarga: keluarga.filter((r) => r.hubungan || r.nama),
      };

      const res = await saveDrh(payload);
      const data = res?.data || {};
      addToast(data?.message || 'Data berhasil disimpan ke database');
      setSelectedFile(null);
      setRawText('');
      setActiveTab('upload');
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || 'Unknown error';
      addToast('Gagal menyimpan: ' + msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const updatePf = (index: number, key: keyof PFRow, value: string) => {
    setPf((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const updatePn = (index: number, key: keyof PNRow, value: string) => {
    setPn((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const updateJab = (index: number, key: keyof JabRow, value: string) => {
    setRJabatan((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const updatePangkat = (index: number, key: keyof PangkatRow, value: string) => {
    setRPangkat((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const updateGaji = (index: number, key: keyof GajiRow, value: string) => {
    setRGaji((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const updateKeluarga = (index: number, key: keyof KeluargaRow, value: string | number) => {
    setKeluarga((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  if (!user) {
    return null;
  }

  const isActive = (navId: string) => {
    return navId === 'import-drh' ? 'text-blue-600 border-l-4 border-blue-600 bg-blue-50' : '';
  };

  const renderNavItem = (item: any, depth = 0) => {
    if (item.roles && !item.roles.includes(user.role)) return null;

    if (item.children) {
      return (
        <div key={item.id}>
          <div
            className="px-4 py-2 text-sm font-medium text-gray-700"
            style={{ paddingLeft: `${12 + depth * 16}px` }}
          >
            {item.label}
          </div>
          {item.children.map((child: any) => renderNavItem(child, depth + 1))}
        </div>
      );
    }

    return (
      <Link
        key={item.id}
        href={`/${item.id}`}
        className={`block px-4 py-3 text-sm font-medium transition-colors ${isActive(
          item.id
        )} hover:bg-gray-100`}
        style={{ paddingLeft: `${16 + depth * 16}px` }}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <>
      <Head>
        <title>Import DRH - Pegawai 2026</title>
      </Head>

      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          // @ts-ignore
          if (window.pdfjsLib) {
            // @ts-ignore
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          }
        }}
      />

      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'w-64' : 'w-20'
          } bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}
        >
          {/* Logo */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            {sidebarOpen && <h1 className="font-bold text-lg">Pegawai 2026</h1>}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              {sidebarOpen ? '←' : '→'}
            </button>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 overflow-y-auto py-4">
            {navItems.map((item) => renderNavItem(item))}
          </nav>

          {/* User & Logout */}
          <div className="border-t border-gray-200 p-4">
            {sidebarOpen && (
              <>
                <div className="text-xs text-gray-600 mb-2">Logged in as:</div>
                <div className="text-sm font-medium text-gray-800 mb-3">{user.nama_ukpd}</div>
              </>
            )}
            <button
              onClick={handleLogout}
              className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              {sidebarOpen ? 'Logout' : '→'}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Import DRH</h2>
              <p className="text-sm text-gray-600 mt-1">Upload dan ekstraksi file PDF DRH pegawai</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">{user.nama_ukpd}</div>
              <div className="text-xs text-gray-500">Role: {roleLabel(user.role)}</div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-6">
            {/* Toasts */}
            <div className="fixed top-6 right-6 space-y-2 z-50">
              {toasts.map((toast) => (
                <div
                  key={toast.id}
                  className={`px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
                    toast.type === 'success'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {toast.message}
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex space-x-4 mb-6 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('upload')}
                className={`px-4 py-3 font-medium transition-colors ${
                  activeTab === 'upload'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Upload File
              </button>
              <button
                onClick={() => setActiveTab('form')}
                disabled={!selectedFile}
                className={`px-4 py-3 font-medium transition-colors ${
                  activeTab === 'form'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed'
                }`}
              >
                Form Data
              </button>
            </div>

            {/* Upload Tab */}
            {activeTab === 'upload' && (
              <div className="max-w-none w-full">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                  <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="text-center">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400 mb-4"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20a4 4 0 004 4h24a4 4 0 004-4V20m-14-6l6-6m0 0l-6-6m6 6H6"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">Upload file PDF DRH</h3>
                      <p className="text-sm text-gray-600 mb-4">Drag and drop atau klik untuk memilih file</p>
                      <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                        Pilih File
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {selectedFile && (
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">File yang dipilih:</h4>
                          <p className="text-sm text-gray-600 mt-1">{selectedFile.name}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleExtract}
                        disabled={isExtracting}
                        className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                      >
                        {isExtracting ? 'Mengekstraksi...' : 'Ekstraksi PDF'}
                      </button>
                    </div>
                  )}

                  <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Informasi:</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>- Maksimal ukuran file: 10 MB</li>
                      <li>- Format yang didukung: PDF</li>
                      <li>- Data akan diekstraksi otomatis dari PDF</li>
                      <li>- Anda dapat mengedit data sebelum menyimpan</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Form Tab */}
            {activeTab === 'form' && selectedFile && (
              <div className="space-y-6 max-w-none w-full">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-gray-700">Lihat teks mentah DRH</summary>
                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      rows={8}
                      className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs"
                    />
                  </details>
                </div>

                {/* Data Diri */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Diri</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Nama *</label>
                      <input
                        type="text"
                        value={nama}
                        onChange={(e) => setNama(e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">NIP *</label>
                      <input
                        type="text"
                        value={nip}
                        onChange={(e) => setNip(e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">NRK</label>
                      <input
                        type="text"
                        value={nrk}
                        onChange={(e) => setNrk(e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">NIK (opsional)</label>
                      <input
                        type="text"
                        value={nik}
                        onChange={(e) => setNik(e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Tempat Lahir</label>
                      <input
                        type="text"
                        value={tempatLahir}
                        onChange={(e) => setTempatLahir(e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Tanggal Lahir</label>
                      <input
                        type="date"
                        value={tglLahir}
                        onChange={(e) => setTglLahir(e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Jenis Kelamin</label>
                      <select
                        value={jk}
                        onChange={(e) => setJk(e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Pilih --</option>
                        <option value="L">Laki-laki</option>
                        <option value="P">Perempuan</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Agama</label>
                      <input
                        type="text"
                        value={agama}
                        onChange={(e) => setAgama(e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Status Perkawinan</label>
                      <select
                        value={statusPerkawinan}
                        onChange={(e) => setStatusPerkawinan(e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Pilih --</option>
                        <option value="BELUM MENIKAH">Belum Menikah</option>
                        <option value="MENIKAH">Menikah</option>
                        <option value="CERAI">Cerai</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Rumpun Jabatan</label>
                      <select
                        value={statusRumpun}
                        onChange={(e) => setStatusRumpun(e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Pilih --</option>
                        <option value="Jabatan Administrator">Jabatan Administrator</option>
                        <option value="Jabatan Administrator / Kepala Puskesmas">Jabatan Administrator / Kepala Puskesmas</option>
                        <option value="Jabatan Fungsional Keahlian Kesehatan">Jabatan Fungsional Keahlian Kesehatan</option>
                        <option value="Jabatan Fungsional Keahlian Non Kesehatan">Jabatan Fungsional Keahlian Non Kesehatan</option>
                        <option value="Jabatan Fungsional Keterampilan Kesehatan">Jabatan Fungsional Keterampilan Kesehatan</option>
                        <option value="Jabatan Fungsional Keterampilan Non Kesehatan">Jabatan Fungsional Keterampilan Non Kesehatan</option>
                        <option value="Jabatan Pelaksana Administrasi Tingkat Ahli">Jabatan Pelaksana Administrasi Tingkat Ahli</option>
                        <option value="Jabatan Pelaksana Administrasi Tingkat Terampil">Jabatan Pelaksana Administrasi Tingkat Terampil</option>
                        <option value="Jabatan Pelaksana Operasional Tingkat Ahli">Jabatan Pelaksana Operasional Tingkat Ahli</option>
                        <option value="Jabatan Pelaksana Operasional Tingkat Terampil">Jabatan Pelaksana Operasional Tingkat Terampil</option>
                        <option value="Jabatan Pelaksana Pelayanan Tingkat Ahli">Jabatan Pelaksana Pelayanan Tingkat Ahli</option>
                        <option value="Jabatan Pelaksana Pelayanan Tingkat Terampil">Jabatan Pelaksana Pelayanan Tingkat Terampil</option>
                        <option value="Jabatan Pelaksana Satuan">Jabatan Pelaksana Satuan</option>
                        <option value="Jabatan Pelaksana Teknis Tingkat Ahli">Jabatan Pelaksana Teknis Tingkat Ahli</option>
                        <option value="Jabatan Pelaksana Teknis Tingkat Terampil">Jabatan Pelaksana Teknis Tingkat Terampil</option>
                        <option value="Jabatan Pengawas">Jabatan Pengawas</option>
                        <option value="Jabatan Pimpinan Tinggi Pratama">Jabatan Pimpinan Tinggi Pratama</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">No HP</label>
                      <input
                        type="tel"
                        value={noHp}
                        onChange={(e) => setNoHp(e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Alamat Utama</h3>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div className="md:col-span-6">
                      <label className="text-sm font-medium text-gray-700">Nama Jalan</label>
                      <input
                        type="text"
                        value={alamatJalan}
                        onChange={(e) => setAlamatJalan(e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">RT</label>
                      <input type="text" value={alamatRt} onChange={(e) => setAlamatRt(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">RW</label>
                      <input type="text" value={alamatRw} onChange={(e) => setAlamatRw(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700">Kelurahan</label>
                      <input type="text" value={alamatKel} onChange={(e) => setAlamatKel(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700">Kecamatan</label>
                      <input type="text" value={alamatKec} onChange={(e) => setAlamatKec(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" />
                    </div>
                    <div className="md:col-span-3">
                      <label className="text-sm font-medium text-gray-700">Kota / Kabupaten</label>
                      <input type="text" value={alamatKota} onChange={(e) => setAlamatKota(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" />
                    </div>
                    <div className="md:col-span-3">
                      <label className="text-sm font-medium text-gray-700">Provinsi</label>
                      <input type="text" value={alamatProv} onChange={(e) => setAlamatProv(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 overflow-x-auto">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Riwayat Pendidikan Formal</h3>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2">No</th>
                        <th className="p-2">Tingkat</th>
                        <th className="p-2">Jurusan</th>
                        <th className="p-2">Tgl Ijazah</th>
                        <th className="p-2">Sekolah</th>
                        <th className="p-2">Kota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pf.map((r, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2">{i + 1}</td>
                          <td className="p-2"><input value={r.tingkat} onChange={(e) => updatePf(i, 'tingkat', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.jurusan} onChange={(e) => updatePf(i, 'jurusan', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input type="date" value={r.tgl_ijazah} onChange={(e) => updatePf(i, 'tgl_ijazah', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.nama_sekolah} onChange={(e) => updatePf(i, 'nama_sekolah', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.kota} onChange={(e) => updatePf(i, 'kota', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 overflow-x-auto">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Riwayat Pendidikan Non Formal</h3>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2">No</th>
                        <th className="p-2">Tgl Ijazah</th>
                        <th className="p-2">Nama Sekolah</th>
                        <th className="p-2">Kota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pn.map((r, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2">{i + 1}</td>
                          <td className="p-2"><input type="date" value={r.tgl_ijazah} onChange={(e) => updatePn(i, 'tgl_ijazah', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.nama_sekolah} onChange={(e) => updatePn(i, 'nama_sekolah', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.kota} onChange={(e) => updatePn(i, 'kota', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 overflow-x-auto">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Riwayat Jabatan</h3>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2">No</th>
                        <th className="p-2">Jenis</th>
                        <th className="p-2">TMT</th>
                        <th className="p-2">Lokasi</th>
                        <th className="p-2">Jabatan</th>
                        <th className="p-2">Pangkat</th>
                        <th className="p-2">Eselon</th>
                        <th className="p-2">No SK</th>
                        <th className="p-2">Tgl SK</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rJabatan.map((r, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2">{i + 1}</td>
                          <td className="p-2"><input value={r.jenis} onChange={(e) => updateJab(i, 'jenis', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input type="date" value={r.tmt} onChange={(e) => updateJab(i, 'tmt', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.lokasi} onChange={(e) => updateJab(i, 'lokasi', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.jabatan} onChange={(e) => updateJab(i, 'jabatan', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.pangkat} onChange={(e) => updateJab(i, 'pangkat', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.eselon} onChange={(e) => updateJab(i, 'eselon', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.no_sk} onChange={(e) => updateJab(i, 'no_sk', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input type="date" value={r.tgl_sk} onChange={(e) => updateJab(i, 'tgl_sk', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 overflow-x-auto">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Riwayat Pangkat</h3>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2">No</th>
                        <th className="p-2">TMT</th>
                        <th className="p-2">Pangkat</th>
                        <th className="p-2">Lokasi</th>
                        <th className="p-2">No SK</th>
                        <th className="p-2">Tgl SK</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rPangkat.map((r, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2">{i + 1}</td>
                          <td className="p-2"><input type="date" value={r.tmt} onChange={(e) => updatePangkat(i, 'tmt', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.pangkat} onChange={(e) => updatePangkat(i, 'pangkat', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.lokasi} onChange={(e) => updatePangkat(i, 'lokasi', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.no_sk} onChange={(e) => updatePangkat(i, 'no_sk', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input type="date" value={r.tgl_sk} onChange={(e) => updatePangkat(i, 'tgl_sk', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 overflow-x-auto">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Riwayat Gaji Pokok</h3>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2">No</th>
                        <th className="p-2">TMT</th>
                        <th className="p-2">Pangkat</th>
                        <th className="p-2">Gaji</th>
                        <th className="p-2">No SK</th>
                        <th className="p-2">Tgl SK</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rGaji.map((r, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2">{i + 1}</td>
                          <td className="p-2"><input type="date" value={r.tmt} onChange={(e) => updateGaji(i, 'tmt', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.pangkat} onChange={(e) => updateGaji(i, 'pangkat', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.gaji} onChange={(e) => updateGaji(i, 'gaji', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.no_sk} onChange={(e) => updateGaji(i, 'no_sk', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input type="date" value={r.tgl_sk} onChange={(e) => updateGaji(i, 'tgl_sk', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 overflow-x-auto">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Riwayat Keluarga</h3>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2">No</th>
                        <th className="p-2">Hubungan</th>
                        <th className="p-2">Nama</th>
                        <th className="p-2">Tempat Lahir</th>
                        <th className="p-2">Tanggal Lahir</th>
                        <th className="p-2">JK</th>
                        <th className="p-2">Tunjangan</th>
                        <th className="p-2">Pekerjaan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keluarga.map((r, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2">{i + 1}</td>
                          <td className="p-2"><input value={r.hubungan} onChange={(e) => updateKeluarga(i, 'hubungan', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.nama} onChange={(e) => updateKeluarga(i, 'nama', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.tempat_lahir} onChange={(e) => updateKeluarga(i, 'tempat_lahir', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input type="date" value={r.tanggal_lahir} onChange={(e) => updateKeluarga(i, 'tanggal_lahir', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.jenis_kelamin} onChange={(e) => updateKeluarga(i, 'jenis_kelamin', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={String(r.tunjangan ?? 0)} onChange={(e) => updateKeluarga(i, 'tunjangan', parseInt(e.target.value || '0', 10) || 0)} className="w-full px-2 py-1 border rounded" /></td>
                          <td className="p-2"><input value={r.pekerjaan} onChange={(e) => updateKeluarga(i, 'pekerjaan', e.target.value)} className="w-full px-2 py-1 border rounded" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    {isSaving ? 'Menyimpan...' : 'Simpan ke Database'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setActiveTab('upload');
                    }}
                    className="px-6 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
};

export default ImportDRHPage;
