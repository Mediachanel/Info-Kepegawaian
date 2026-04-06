import axios from 'axios';
import { clearStoredUser, getStoredUser, storeUser, type AuthUser } from '@/lib/auth';

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const API_ROOT = RAW_API_URL.replace(/\/+$/, '');
const REMOTE_API_PATTERN = /api\.kepegawaian\.media/i;
const isRemoteApi = REMOTE_API_PATTERN.test(API_ROOT);
const API_BASE_URL =
  API_ROOT.endsWith('/api') || isRemoteApi ? API_ROOT : `${API_ROOT}/api`;

const REMOTE_CACHE_TTL_MS = 60_000;
const REMOTE_PAGE_SIZE = 2000;
const REMOTE_MAX_PAGES = 20;

type PegawaiParams = {
  limit?: number;
  offset?: number;
  lite?: 1 | 0 | boolean;
  full?: 1 | 0 | boolean;
  unit?: string;
  wilayah?: string;
  jabatan?: string;
  status?: string;
  search?: string;
};

type DashboardParams = { unit?: string; wilayah?: string };
type DukParams = { unit?: string };

type RemotePegawai = Record<string, any>;

const createApiClient = (baseURL: string) => {
  const client = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  client.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  });

  return client;
};

const api = createApiClient(API_BASE_URL);
let remotePegawaiCache: RemotePegawai[] | null = null;
let remotePegawaiCacheTime = 0;
let remotePegawaiPromise: Promise<RemotePegawai[]> | null = null;

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeUpper = (value: unknown) => normalizeText(value).toUpperCase();

const parseDateValue = (value: unknown) => {
  const text = normalizeText(value);
  if (!text) return '';
  const time = Date.parse(text);
  if (Number.isNaN(time)) return text;
  return new Date(time).toISOString();
};

const getPayloadData = <T = any>(payload: any): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T;
  }
  return payload as T;
};

const getPayloadRows = (payload: any): any[] => {
  const data = getPayloadData(payload);
  if (Array.isArray(data)) return data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
};

const DETAIL_HISTORY_KEYS = [
  'alamat',
  'pasangan',
  'anak',
  'gaji_pokok',
  'hukuman_disiplin',
  'jabatan_fungsional',
  'jabatan_struktural',
  'pangkat',
  'pendidikan_formal',
  'pendidikan_nonformal',
  'penghargaan',
  'skp',
];

const hasDetailHistory = (row: Record<string, any>) =>
  DETAIL_HISTORY_KEYS.some((key) => key === 'pasangan' ? row?.[key] : Array.isArray(row?.[key]));

const inferStatus = (row: Record<string, any>) => {
  const candidates = [
    row.status_pegawai,
    row.jenis_pegawai,
    row.nama_status_aktif,
    row.status_pegawai,
    row.status_rumpun,
    row.nama_status_rumpun,
    row.nama_jenis_pegawai,
  ];
  const text = normalizeUpper(candidates.find(Boolean));
  if (text === 'PNS') return 'PNS';
  if (text === 'CPNS') return 'CPNS';
  if (text.includes('PPPK') || text.includes('P3K')) return 'PPPK';
  if (
    text === 'NON PNS' ||
    text.includes('NON ASN') ||
    text.includes('NON PNS') ||
    text.includes('PROFESIONAL')
  ) {
    return 'NON PNS';
  }
  if (text.includes('PJLP')) return 'PJLP';
  return normalizeText(candidates.find(Boolean));
};

const normalizePegawaiRow = (raw: Record<string, any>): Record<string, any> => {
  const status = inferStatus(raw);
  const wilayah = raw.wilayah || raw.wilayah_ukpd || '';
  const namaUkpd = raw.nama_ukpd || raw.ukpd || '';
  const jenjangPendidikan =
    raw.jenjang_pendidikan || raw.tingkat_pendidikan || raw.pendidikan || '';
  const programStudi = raw.program_studi || raw.jurusan_pendidikan || raw.jurusan || '';

  return {
    ...raw,
    id_pegawai: raw.id_pegawai ?? raw.id ?? raw.idPegawai ?? raw.pegawai_id,
    nama: raw.nama || raw.nama_pegawai || '',
    nama_pegawai: raw.nama_pegawai || raw.nama || '',
    nama_jabatan_orb: raw.nama_jabatan_orb || raw.jabatan || '',
    jabatan: raw.jabatan || raw.nama_jabatan_orb || '',
    nama_ukpd: namaUkpd,
    wilayah,
    wilayah_ukpd: wilayah,
    status_rumpun: raw.status_rumpun || raw.nama_status_rumpun || status,
    nama_status_rumpun: raw.nama_status_rumpun || raw.status_rumpun || status,
    nama_status_aktif: raw.nama_status_aktif || status,
    jenis_pegawai: raw.jenis_pegawai || raw.nama_status_aktif || status,
    status_pegawai:
      raw.status_pegawai || raw.nama_status_aktif || raw.jenis_pegawai || status,
    kondisi: raw.kondisi || raw.nama_kondisi || '',
    pangkat_golongan: raw.pangkat_golongan || raw.pangkat || '',
    tmt_pangkat_terakhir: parseDateValue(raw.tmt_pangkat_terakhir),
    tmt_kerja_ukpd: parseDateValue(raw.tmt_kerja_ukpd),
    tanggal_lahir: parseDateValue(raw.tanggal_lahir),
    pendidikan_sk_pangkat:
      raw.pendidikan_sk_pangkat || raw.jenjang_pendidikan || raw.tingkat_pendidikan || '',
    jenjang_pendidikan: jenjangPendidikan,
    program_studi: programStudi,
    nama_universitas: raw.nama_universitas || raw.sekolah || '',
    status_perkawinan: raw.status_perkawinan || raw.status_nikah || '',
    pendidikan_formal: Array.isArray(raw.pendidikan_formal) ? raw.pendidikan_formal : [],
    pendidikan_nonformal: Array.isArray(raw.pendidikan_nonformal) ? raw.pendidikan_nonformal : [],
    jabatan_fungsional: Array.isArray(raw.jabatan_fungsional) ? raw.jabatan_fungsional : [],
    jabatan_struktural: Array.isArray(raw.jabatan_struktural) ? raw.jabatan_struktural : [],
    pangkat: Array.isArray(raw.pangkat) ? raw.pangkat : [],
    alamat: Array.isArray(raw.alamat) ? raw.alamat : [],
    pasangan: raw.pasangan || null,
    anak: Array.isArray(raw.anak) ? raw.anak : [],
    gaji_pokok: Array.isArray(raw.gaji_pokok) ? raw.gaji_pokok : [],
    hukuman_disiplin: Array.isArray(raw.hukuman_disiplin) ? raw.hukuman_disiplin : [],
    penghargaan: Array.isArray(raw.penghargaan) ? raw.penghargaan : [],
    skp: Array.isArray(raw.skp) ? raw.skp : [],
  };
};

const sortByName = (a: Record<string, any>, b: Record<string, any>) =>
  normalizeText(a.nama || a.nama_pegawai).localeCompare(
    normalizeText(b.nama || b.nama_pegawai),
    'id-ID'
  );

const filterRemotePegawai = (rows: Record<string, any>[], params?: PegawaiParams) => {
  let filtered = [...rows];

  if (params?.unit) {
    const target = normalizeUpper(params.unit);
    filtered = filtered.filter((row) => normalizeUpper(row.nama_ukpd) === target);
  }

  if (params?.wilayah) {
    const target = normalizeUpper(params.wilayah);
    filtered = filtered.filter((row) => normalizeUpper(row.wilayah || row.wilayah_ukpd) === target);
  }

  if (params?.jabatan) {
    const target = normalizeUpper(params.jabatan);
    filtered = filtered.filter((row) =>
      normalizeUpper(row.nama_jabatan_orb || row.jabatan).includes(target)
    );
  }

  if (params?.status) {
    const statuses = params.status
      .split(',')
      .map((item) => normalizeUpper(item))
      .filter(Boolean);
    if (statuses.length) {
      filtered = filtered.filter((row) => statuses.includes(normalizeUpper(inferStatus(row))));
    }
  }

  if (params?.search) {
    const target = normalizeUpper(params.search);
    filtered = filtered.filter((row) =>
      [
        row.nama,
        row.nama_pegawai,
        row.nrk,
        row.nip,
        row.nik,
        row.nama_ukpd,
        row.nama_jabatan_orb,
      ]
        .map(normalizeUpper)
        .join(' ')
        .includes(target)
    );
  }

  const total = filtered.length;
  const offset = Math.max(0, Number(params?.offset) || 0);
  const limit =
    params?.limit === undefined ? total : Math.max(0, Number(params.limit) || 0);
  const pageRows =
    params?.limit === undefined ? filtered : filtered.slice(offset, offset + limit);

  return {
    rows: pageRows,
    total,
    limit: params?.limit,
    offset,
  };
};

const countBy = (rows: Record<string, any>[], keyFn: (row: Record<string, any>) => string) => {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const key = normalizeText(keyFn(row));
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
};

const buildDashboardPayload = (rows: Record<string, any>[]) => {
  const statusCountsMap = countBy(rows, (row) => inferStatus(row));
  const genderCountsMap = countBy(rows, (row) => row.jenis_kelamin);
  const maritalCountsMap = countBy(rows, (row) => row.status_perkawinan);

  const unitStatus: Array<Record<string, any>> = [];
  const unitGender: Array<Record<string, any>> = [];
  const unitMarital: Array<Record<string, any>> = [];
  const rumpunStatus: Array<Record<string, any>> = [];
  const rumpunGender: Array<Record<string, any>> = [];
  const rumpunMarital: Array<Record<string, any>> = [];
  const pendidikanStatus: Array<Record<string, any>> = [];
  const pendidikanGender: Array<Record<string, any>> = [];
  const pendidikanMarital: Array<Record<string, any>> = [];

  const pushCounterRows = (
    target: Array<Record<string, any>>,
    mapKey: string,
    valueKey: string,
    sourceRows: Record<string, any>[],
    valueFn: (row: Record<string, any>) => string
  ) => {
    const bucket = new Map<string, number>();
    sourceRows.forEach((row) => {
      const label = normalizeText(row[mapKey]);
      const value = normalizeText(valueFn(row));
      if (!label || !value) return;
      const composite = `${label}|||${value}|||${normalizeText(row.wilayah || row.wilayah_ukpd)}`;
      bucket.set(composite, (bucket.get(composite) || 0) + 1);
    });

    bucket.forEach((count, composite) => {
      const [label, value, wilayah] = composite.split('|||');
      target.push({
        [mapKey === 'rumpun' ? 'rumpun' : mapKey === 'pendidikan' ? 'pendidikan' : 'unit']: label,
        wilayah,
        [valueKey]: value,
        count,
      });
    });
  };

  pushCounterRows(unitStatus, 'unit', 'status', rows.map((row) => ({ ...row, unit: row.nama_ukpd })), (row) => inferStatus(row));
  pushCounterRows(unitGender, 'unit', 'gender', rows.map((row) => ({ ...row, unit: row.nama_ukpd })), (row) => row.jenis_kelamin);
  pushCounterRows(unitMarital, 'unit', 'marital', rows.map((row) => ({ ...row, unit: row.nama_ukpd })), (row) => row.status_perkawinan);
  pushCounterRows(rumpunStatus, 'rumpun', 'status', rows.map((row) => ({ ...row, rumpun: row.status_rumpun || row.nama_status_rumpun })), (row) => inferStatus(row));
  pushCounterRows(rumpunGender, 'rumpun', 'gender', rows.map((row) => ({ ...row, rumpun: row.status_rumpun || row.nama_status_rumpun })), (row) => row.jenis_kelamin);
  pushCounterRows(rumpunMarital, 'rumpun', 'marital', rows.map((row) => ({ ...row, rumpun: row.status_rumpun || row.nama_status_rumpun })), (row) => row.status_perkawinan);
  pushCounterRows(
    pendidikanStatus,
    'pendidikan',
    'status',
    rows.map((row) => ({
      ...row,
      pendidikan:
        row.pendidikan_sk_pangkat || row.jenjang_pendidikan || '(Tidak Tercatat)',
    })),
    (row) => inferStatus(row)
  );
  pushCounterRows(
    pendidikanGender,
    'pendidikan',
    'gender',
    rows.map((row) => ({
      ...row,
      pendidikan:
        row.pendidikan_sk_pangkat || row.jenjang_pendidikan || '(Tidak Tercatat)',
    })),
    (row) => row.jenis_kelamin
  );
  pushCounterRows(
    pendidikanMarital,
    'pendidikan',
    'marital',
    rows.map((row) => ({
      ...row,
      pendidikan:
        row.pendidikan_sk_pangkat || row.jenjang_pendidikan || '(Tidak Tercatat)',
    })),
    (row) => row.status_perkawinan
  );

  return {
    ok: true,
    total: rows.length,
    statusCounts: Array.from(statusCountsMap.entries()).map(([status, count]) => ({ status, count })),
    genderCounts: Array.from(genderCountsMap.entries()).map(([gender, count]) => ({ gender, count })),
    maritalCounts: Array.from(maritalCountsMap.entries()).map(([marital, count]) => ({ marital, count })),
    unitStatus,
    unitGender,
    unitMarital,
    rumpunStatus,
    rumpunGender,
    rumpunMarital,
    pendidikanStatus,
    pendidikanGender,
    pendidikanMarital,
  };
};

const normalizeAuthUser = (candidate: any, fallbackName: string): AuthUser => {
  const raw = candidate && typeof candidate === 'object' ? candidate : {};
  const namaUkpd =
    raw.nama_ukpd ||
    raw.ukpd ||
    raw.nama_unit ||
    raw.unit ||
    raw.username ||
    fallbackName;

  return {
    id_ukpd: String(
      raw.id_ukpd || raw.id || raw.ukpd_id || raw.user_id || raw.username || namaUkpd
    ),
    nama_ukpd: String(namaUkpd),
    role: raw.role || raw.level || raw.tipe_akses || 'ukpd',
    wilayah: raw.wilayah || raw.wilayah_ukpd || null,
  };
};

const storeAuthPayload = (payload: any, fallbackName: string) => {
  const token =
    payload?.token ||
    payload?.access_token ||
    payload?.data?.token ||
    payload?.data?.access_token;
  const userCandidate =
    payload?.user ||
    payload?.data?.user ||
    payload?.data ||
    payload;

  if (token && typeof window !== 'undefined') {
    localStorage.setItem('token', token);
  }

  const user = normalizeAuthUser(userCandidate, fallbackName);
  storeUser(user);
  return user;
};

const clearRemotePegawaiCache = () => {
  remotePegawaiCache = null;
  remotePegawaiCacheTime = 0;
  remotePegawaiPromise = null;
};

const fetchRemotePegawai = async () => {
  const now = Date.now();
  if (remotePegawaiCache && now - remotePegawaiCacheTime < REMOTE_CACHE_TTL_MS) {
    return remotePegawaiCache;
  }

  if (remotePegawaiPromise) {
    return remotePegawaiPromise;
  }

  remotePegawaiPromise = api
    .get('/pegawai', {
      params: {
        limit: REMOTE_PAGE_SIZE,
        offset: 0,
      },
    })
    .then(async (response) => {
      const rows = getPayloadRows(response.data).map((row) => normalizePegawaiRow(row));
      const seenIds = new Set(rows.map((row) => String(row.id_pegawai || row.id || '')));
      let offset = rows.length;
      let page = 1;

      while (
        offset > 0 &&
        offset % REMOTE_PAGE_SIZE === 0 &&
        page < REMOTE_MAX_PAGES
      ) {
        const nextResponse = await api.get('/pegawai', {
          params: {
            limit: REMOTE_PAGE_SIZE,
            offset,
          },
        });
        const nextRows = getPayloadRows(nextResponse.data).map((row) => normalizePegawaiRow(row));
        if (!nextRows.length) break;

        const freshRows = nextRows.filter((row) => {
          const id = String(row.id_pegawai || row.id || '');
          if (!id || seenIds.has(id)) return false;
          seenIds.add(id);
          return true;
        });

        if (!freshRows.length) break;

        rows.push(...freshRows);
        if (nextRows.length < REMOTE_PAGE_SIZE) break;
        offset += nextRows.length;
        page += 1;
      }

      rows.sort(sortByName);
      remotePegawaiCache = rows;
      remotePegawaiCacheTime = Date.now();
      remotePegawaiPromise = null;
      return rows;
    })
    .catch((error) => {
      remotePegawaiPromise = null;
      throw error;
    });

  return remotePegawaiPromise;
};

export async function login(nama_ukpd: string, password: string) {
  const body = {
    nama_ukpd,
    username: nama_ukpd,
    user: nama_ukpd,
    password,
  };

  const attempts = isRemoteApi ? ['/auth/login', '/login'] : ['/auth/login'];
  let lastError: any;

  for (const endpoint of attempts) {
    try {
      const response = await api.post(endpoint, body);
      const payload = response.data || {};
      storeAuthPayload(payload, nama_ukpd);
      return {
        ...payload,
        ok: payload?.ok ?? payload?.success ?? true,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export function logout() {
  clearStoredUser();
}

export async function getCurrentUser() {
  if (isRemoteApi) {
    return { data: { user: getStoredUser(), ok: true } };
  }
  return await api.get('/auth/me');
}

export async function getPegawai(params?: PegawaiParams) {
  if (!isRemoteApi) {
    return await api.get('/pegawai', { params });
  }

  const onlyPagingParams =
    params &&
    Object.keys(params).every((key) => ['limit', 'offset', 'lite', 'full'].includes(key));

  if (onlyPagingParams) {
    const response = await api.get('/pegawai', { params });
    const payload = response.data || {};
    const rows = getPayloadRows(payload).map((row) => normalizePegawaiRow(row));
    return {
      data: {
        ...payload,
        rows,
        total: payload?.total ?? rows.length,
        ok: payload?.ok ?? payload?.success ?? true,
      },
    };
  }

  const rows = await fetchRemotePegawai();
  const filtered = filterRemotePegawai(rows, params);
  return {
    data: {
      ok: true,
      rows: filtered.rows,
      total: filtered.total,
      limit: params?.limit,
      offset: filtered.offset,
    },
  };
}

export async function getPegawaiFilters() {
  if (!isRemoteApi) {
    return await api.get('/pegawai/filters');
  }

  const rows = await fetchRemotePegawai();
  const jabatan = Array.from(
    new Set(rows.map((row) => normalizeText(row.nama_jabatan_orb || row.jabatan)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'id-ID'));
  const status = Array.from(
    new Set(rows.map((row) => normalizeText(inferStatus(row))).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'id-ID'));

  return { data: { jabatan, status } };
}

export async function getDashboardStats(params?: DashboardParams) {
  if (!isRemoteApi) {
    return await api.get('/dashboard-stats', { params });
  }

  const rows = await fetchRemotePegawai();
  const filtered = filterRemotePegawai(rows, {
    unit: params?.unit,
    wilayah: params?.wilayah,
  }).rows.filter((row) => {
    const kondisi = normalizeUpper(row.kondisi || 'AKTIF');
    return kondisi === 'AKTIF' || kondisi === 'TUGAS BELAJAR';
  });

  return { data: buildDashboardPayload(filtered) };
}

export async function getPegawaiById(id: number | string) {
  if (!isRemoteApi) {
    return await api.get(`/pegawai/${id}`);
  }

  const response = await api.get(`/pegawai/${id}`);
  const normalized = normalizePegawaiRow(getPayloadData(response.data));

  if (hasDetailHistory(normalized) || !normalized?.nik) {
    return { data: normalized };
  }

  try {
    const byNikResponse = await api.get(`/pegawai/by-nik/${encodeURIComponent(String(normalized.nik))}`);
    return {
      data: normalizePegawaiRow(getPayloadData(byNikResponse.data)),
    };
  } catch {
    return { data: normalized };
  }
}

export async function createPegawai(payload: any) {
  if (!isRemoteApi) {
    return await api.post('/pegawai', payload);
  }

  const response = await api.post('/pegawai/create', payload);
  clearRemotePegawaiCache();
  return response;
}

export async function updatePegawai(id: number | string, payload: any) {
  const response = await api.put(`/pegawai/${id}`, payload);
  clearRemotePegawaiCache();
  return response;
}

export async function getUkpd() {
  if (!isRemoteApi) {
    return await api.get('/ukpd');
  }

  const rows = await fetchRemotePegawai();
  const map = new Map<string, { id_ukpd: string; nama_ukpd: string; wilayah: string | null }>();

  rows.forEach((row) => {
    const namaUkpd = normalizeText(row.nama_ukpd);
    if (!namaUkpd || map.has(namaUkpd)) return;
    map.set(namaUkpd, {
      id_ukpd: String(row.id_ukpd || row.id || namaUkpd),
      nama_ukpd: namaUkpd,
      wilayah: row.wilayah || row.wilayah_ukpd || null,
    });
  });

  return {
    data: {
      rows: Array.from(map.values()).sort((a, b) =>
        a.nama_ukpd.localeCompare(b.nama_ukpd, 'id-ID')
      ),
    },
  };
}

export async function getDuk(params?: DukParams) {
  if (!isRemoteApi) {
    return await api.get('/duk', { params });
  }

  const rows = await fetchRemotePegawai();
  const filtered = filterRemotePegawai(
    rows
      .filter((row) => normalizeUpper(inferStatus(row)) === 'PNS')
      .map((row) => ({
        ...row,
        pangkat: Array.isArray(row.pangkat) ? row.pangkat : [],
        pendidikan_formal: Array.isArray(row.pendidikan_formal) ? row.pendidikan_formal : [],
        pendidikan_nonformal: Array.isArray(row.pendidikan_nonformal) ? row.pendidikan_nonformal : [],
        jabatan: [
          ...(Array.isArray(row.jabatan_struktural) ? row.jabatan_struktural : []),
          ...(Array.isArray(row.jabatan_fungsional) ? row.jabatan_fungsional : []),
        ],
      })),
    { unit: params?.unit }
  ).rows;

  filtered.sort((a, b) => {
    const gol = normalizeUpper(b.pangkat_golongan).localeCompare(normalizeUpper(a.pangkat_golongan));
    if (gol !== 0) return gol;
    const tmtPangkat = Date.parse(a.tmt_pangkat_terakhir || '') - Date.parse(b.tmt_pangkat_terakhir || '');
    if (!Number.isNaN(tmtPangkat) && tmtPangkat !== 0) return tmtPangkat;
    const lahir = Date.parse(a.tanggal_lahir || '') - Date.parse(b.tanggal_lahir || '');
    if (!Number.isNaN(lahir) && lahir !== 0) return lahir;
    return sortByName(a, b);
  });

  return {
    data: {
      rows: filtered,
      unit: params?.unit || '',
      total: filtered.length,
      source: 'remote-api',
    },
  };
}

export async function saveDrh(payload: any) {
  if (isRemoteApi) {
    throw new Error('Endpoint import DRH belum tersedia di API online.');
  }

  return api.post('/drh/save', payload);
}

export async function getUsulanMutasi(params?: {
  status?: string;
  created_by_ukpd?: string;
  q?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    return await api.get('/usulan/mutasi', { params });
  } catch (error) {
    if (isRemoteApi) {
      throw new Error('Endpoint usulan mutasi belum tersedia di API online.');
    }
    throw error;
  }
}

export async function createUsulanMutasi(payload: any) {
  try {
    return await api.post('/usulan/mutasi', payload);
  } catch (error) {
    if (isRemoteApi) {
      throw new Error('Endpoint usulan mutasi belum tersedia di API online.');
    }
    throw error;
  }
}

export default api;
