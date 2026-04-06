import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { getDuk, logout } from '@/lib/api';
import { getStoredUser, normalizeRole, roleLabel } from '@/lib/auth';
import { navItems } from '@/lib/nav';

type DukRow = {
  id_pegawai: number | string;
  nik?: string;
  nip?: string;
  nrk?: string;
  nama?: string;
  nama_jabatan_orb?: string;
  status_rumpun?: string;
  pangkat_golongan?: string;
  tmt_pangkat_terakhir?: string;
  nama_ukpd?: string;
  pangkat?: Array<{ tmt?: string; pangkat?: string }>;
  pendidikan_formal?: Array<{ tingkat?: string; jurusan?: string; tanggal_ijazah?: string }>;
  pendidikan_nonformal?: Array<{ nama_pelatihan?: string; tanggal_ijazah?: string }>;
  jabatan?: Array<{ tmt?: string; jabatan?: string; lokasi?: string }>;
};

const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const tglId = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const d = String(date.getDate()).padStart(2, '0');
  const m = monthShort[date.getMonth()];
  const y = date.getFullYear();
  return `${d} ${m} ${y}`;
};

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');

const pangkatWithGol = (pangkatRaw?: string) => {
  const orig = String(pangkatRaw || '').trim();
  if (!orig) return '';
  const u = orig.toUpperCase();
  if (/\b[IV]{1,3}\s*[-\/ ]?\s*[A-E]\b/.test(u)) return orig;

  const rules: Array<[RegExp, string]> = [
    [/(JURU\s+MUDA\s+TINGKAT\s*I|JURU\s+MUDA\s+TK\.?\s*I)/i, 'I/b'],
    [/(JURU\s+TINGKAT\s*I|JURU\s+TK\.?\s*I)/i, 'I/d'],
    [/\bJURU\s+MUDA\b/i, 'I/a'],
    [/\bJURU\b/i, 'I/c'],
    [/(PENGATUR\s+MUDA\s+TINGKAT\s*I|PENGATUR\s+MUDA\s+TK\.?\s*I)/i, 'II/b'],
    [/(PENGATUR\s+TINGKAT\s*I|PENGATUR\s+TK\.?\s*I)/i, 'II/d'],
    [/\bPENGATUR\s+MUDA\b/i, 'II/a'],
    [/\bPENGATUR\b/i, 'II/c'],
    [/(PENATA\s+MUDA\s+TINGKAT\s*I|PENATA\s+MUDA\s+TK\.?\s*I)/i, 'III/b'],
    [/(PENATA\s+TINGKAT\s*I|PENATA\s+TK\.?\s*I)/i, 'III/d'],
    [/\bPENATA\s+MUDA\b/i, 'III/a'],
    [/\bPENATA\b/i, 'III/c'],
    [/(PEMBINA\s+TINGKAT\s*I|PEMBINA\s+TK\.?\s*I)/i, 'IV/b'],
    [/\bPEMBINA\s+MUDA\b/i, 'IV/c'],
    [/\bPEMBINA\s+MADYA\b/i, 'IV/d'],
    [/\bPEMBINA\s+UTAMA\b/i, 'IV/e'],
    [/\bPEMBINA\b/i, 'IV/a'],
  ];
  for (const [re, gol] of rules) {
    if (re.test(u)) return `${orig} (Gol. ${gol})`;
  }
  return orig;
};

const sortByDateDesc = <T extends { tmt?: string }>(rows?: T[]) => {
  if (!rows) return [];
  return [...rows].sort((a, b) => {
    const ta = a.tmt ? new Date(a.tmt).getTime() : 0;
    const tb = b.tmt ? new Date(b.tmt).getTime() : 0;
    return tb - ta;
  });
};

const diffDuration = (from?: string, to?: string) => {
  if (!from) return '—';
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years === 0 && remMonths === 0) return '0 bln';
  if (years > 0 && remMonths > 0) return `${years} th ${remMonths} bln`;
  if (years > 0) return `${years} th`;
  return `${remMonths} bln`;
};

export default function DukPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser());
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<DukRow[]>([]);
  const [statusText, setStatusText] = useState('memuat data...');
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = normalizeRole(user?.role);
  const menuItems = useMemo(() => {
    return navItems.filter((item) => {
      if (!item.roles || item.roles.length === 0) return true;
      return item.roles.includes(role);
    });
  }, [role]);
  const isReady = mounted && !!user;
  const displayRole = mounted ? roleLabel(user?.role) : 'Pengguna';
  const displayUkpd = mounted ? user?.nama_ukpd || 'Dinas Kesehatan' : 'Dinas Kesehatan';

  const navPath = (navId: string) => {
    const map: Record<string, string> = {
      dashboard: '/dashboard',
      pegawai: '/pegawai',
      mutasi: '/usulan/mutasi',
      'putus-jf': '/usulan/putus-jf',
      'import-drh': '/import-drh',
      duk: '/duk',
      pangkat: '/pangkat',
      qna: '/qna',
    };
    return map[navId] || '#';
  };

  const isActive = (path: string) => router.pathname === path;

  const renderIcon = (icon: string) => {
    const map: Record<string, string> = {
      dashboard: 'D',
      users: 'P',
      swap: 'U',
      briefcase: 'J',
      upload: 'I',
      badge: 'K',
      chat: 'Q',
    };
    return map[icon] || 'M';
  };

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace('/');
      return;
    }
    setUser(stored);
  }, [router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      setStatusText('memuat data...');
      try {
        const params: { unit?: string } = {};
        if (user?.nama_ukpd) params.unit = user.nama_ukpd;
        const response = await getDuk(params);
        const data = response?.data?.rows || [];
        setRows(data);
        setStatusText('data siap.');
      } catch (err: any) {
        const msg = err?.response?.data?.error || err?.message || 'Gagal memuat data';
        setStatusText(`gagal: ${msg}`);
      }
    };
    loadData();
  }, [user]);

  const filteredRows = useMemo(() => {
    const needle = search.toLowerCase().trim();
    if (!needle) return rows;
    return rows.filter((row) => {
      const hay = `${row.nama || ''} ${row.nrk || ''} ${row.nip || ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, search]);

  const exportExcel = () => {
    const header = [
      'NO',
      'NAMA / NRK / NIP / JABATAN',
      'GOL / PANGKAT',
      'TMT PANGKAT',
      'PENDIDIKAN FORMAL',
      'DIKLAT / KURSUS / PELATIHAN',
      'RIWAYAT JABATAN',
      'UKPD',
      'TMT JABATAN',
      'LAMA',
    ];

    const body = filteredRows
      .map((row, idx) => {
        const pangkatList = row.pangkat?.length
          ? row.pangkat.map((p) => pangkatWithGol(p.pangkat)).filter(Boolean)
          : [pangkatWithGol(row.pangkat_golongan)];
        const tmtPangkatList = row.pangkat?.length
          ? row.pangkat.map((p) => tglId(p.tmt))
          : [tglId(row.tmt_pangkat_terakhir)];
        const pendidikanList = row.pendidikan_formal?.length
          ? row.pendidikan_formal.map((p) => `${p.tingkat || ''} - ${p.jurusan || ''} (${tglId(p.tanggal_ijazah)})`)
          : ['—'];
        const diklatList = row.pendidikan_nonformal?.length
          ? row.pendidikan_nonformal.map((p) => `- ${p.nama_pelatihan || ''} (${tglId(p.tanggal_ijazah)})`)
          : ['—'];
        const jabatanSorted = sortByDateDesc(row.jabatan);
        const jabatanList = jabatanSorted.map((j) => `- ${j.jabatan || ''}`);
        const ukpdList = jabatanSorted.map((j) => (j.lokasi ? `- ${j.lokasi}` : '-'));
        const tmtJabatanList = jabatanSorted.map((j) => tglId(j.tmt));
        const lamaList = jabatanSorted.map((j, i) => diffDuration(j.tmt, jabatanSorted[i - 1]?.tmt));
        const jabatanNow = sortByDateDesc(row.jabatan)[0]?.jabatan || row.nama_jabatan_orb || '—';

        const namaCol = `${row.nama || ''}\n${row.nrk || '—'} / ${row.nip || '—'}\n${jabatanNow}`;

        const cols = [
          String(idx + 1),
          namaCol,
          pangkatList.join('\n') || '—',
          tmtPangkatList.join('\n') || '—',
          pendidikanList.join('\n') || '—',
          diklatList.join('\n') || '—',
          jabatanList.join('\n') || '—',
          ukpdList.join('\n') || '—',
          tmtJabatanList.join('\n') || '—',
          lamaList.join('\n') || '—',
        ].map(escapeHtml);

        return `<tr>${cols.map((c) => `<td>${c.replace(/\n/g, '<br>')}</td>`).join('')}</tr>`;
      })
      .join('');

    const tableHtml = `<table border="1"><thead><tr>${header
      .map((h) => `<th>${escapeHtml(h)}</th>`)
      .join('')}</tr></thead><tbody>${body}</tbody></table>`;
    const blob = new Blob(
      [
        `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>${tableHtml}</body></html>`,
      ],
      { type: 'application/vnd.ms-excel;charset=utf-8;' }
    );
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `DUK_${(user?.nama_ukpd || 'DINKES').replace(/\s+/g, '_')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <>
      <Head>
        <title>DUK Pegawai</title>
        <link rel="icon" type="image/png" href="/foto/Dinkes.png" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="pegawai-page">
        {sidebarOpen ? (
          <div
            id="sidebarBackdrop"
            className="show"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}
        <button
          type="button"
          className="mobile-toggle"
          aria-label="Buka menu"
          onClick={() => setSidebarOpen((prev) => !prev)}
        >
          <span aria-hidden="true">&#9776;</span> Menu
        </button>
        <div className="layout">
          <aside className={`sidebar ${sidebarOpen ? 'show' : ''}`}>
            <div className="logo">
              <img src="/foto/Dinkes.png" alt="Logo Dinkes" />
              <div>
                <div className="logo-title">SI Data Pegawai</div>
                <div className="logo-sub">Dinas Kesehatan</div>
              </div>
            </div>
            <nav>
              {isReady &&
                menuItems.map((item) => {
                  if (item.children && item.children.length) {
                    return (
                      <div key={item.id}>
                        <div className="nav-title">{item.label}</div>
                        {item.children.map((child) => {
                          const path = navPath(child.id);
                          return (
                            <Link
                              key={child.id}
                              href={path}
                              className={`nav-item ${isActive(path) ? 'active' : ''}`}
                              onClick={() => setSidebarOpen(false)}
                            >
                              <span className="icon-round">{renderIcon(child.icon)}</span>
                              <span>{child.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    );
                  }
                  const path = navPath(item.id);
                  return (
                    <Link
                      key={item.id}
                      href={path}
                      className={`nav-item ${isActive(path) ? 'active' : ''}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="icon-round">{renderIcon(item.icon)}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
            </nav>
            <div className="sidebar-footer">
              <div className="footer-title">Akses Login</div>
              <div className="footer-name" suppressHydrationWarning>
                {displayUkpd}
              </div>
              <div className="footer-role" suppressHydrationWarning>
                {displayRole}
              </div>
              <button type="button" className="ghost-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </aside>

          <div className="content">
            <header className="topbar">
              <div className="toolbar">
                <span className="badge" suppressHydrationWarning>
                  {displayRole.toUpperCase()}
                </span>
                <span className="badge secondary" suppressHydrationWarning>
                  {displayUkpd}
                </span>
              </div>
              <button type="button" className="danger-btn" onClick={handleLogout}>
                Keluar
              </button>
            </header>

            <main id="mainWrap" className="px-2 sm:px-3 lg:px-4 py-3 bg-slate-50 min-h-screen">
              <div className="w-full">
                <div className="bg-white shadow-sm border border-slate-200 rounded-2xl px-3 py-3 sm:px-5 sm:py-4 mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold tracking-wide text-sky-600 uppercase">
                      Daftar Urut Kepangkatan
                    </div>
                    <h1 className="text-base sm:text-lg font-bold text-slate-800 truncate">
                      DINAS KESEHATAN
                    </h1>
                    <div className="text-xs font-semibold text-slate-700">
                      PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      UKPD: <span className="font-medium text-slate-700">{displayUkpd}</span> · Jumlah PNS:{' '}
                      <span className="font-semibold text-emerald-600">{filteredRows.length}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Status: {statusText}</div>
                  </div>

                  <div className="flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                      <input
                        type="text"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        placeholder="Cari Nama / NRK..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400 text-xs">
                        🔍
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={exportExcel}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1"
                    >
                      <span className="sm:inline">Export Excel</span>
                      <span className="sm:hidden inline">Export</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white shadow-sm border border-slate-200 rounded-2xl p-2 sm:p-3 lg:p-4 overflow-x-auto w-full">
                  <table className="w-full text-[11px] align-top border border-slate-200">
                    <thead className="bg-sky-500 text-white">
                      <tr>
                        <th className="px-2 py-2 border border-sky-600 text-center whitespace-nowrap">NO</th>
                        <th className="px-2 py-2 border border-sky-600 text-left whitespace-nowrap">
                          NAMA<br />
                          NRK / NIP<br />
                          Jabatan Saat Ini
                        </th>
                        <th className="px-2 py-2 border border-sky-600 text-left whitespace-nowrap">
                          GOL / PANGKAT<br />
                          (Semua Riwayat)
                        </th>
                        <th className="px-2 py-2 border border-sky-600 text-left whitespace-nowrap">TMT PANGKAT</th>
                        <th className="px-2 py-2 border border-sky-600 text-left whitespace-nowrap">
                          PENDIDIKAN FORMAL<br />
                          (Semua)
                        </th>
                        <th className="px-2 py-2 border border-sky-600 text-left whitespace-nowrap">
                          DIKLAT / KURSUS / PELATIHAN
                        </th>
                        <th className="px-2 py-2 border border-sky-600 text-left whitespace-nowrap">RIWAYAT JABATAN</th>
                        <th className="px-2 py-2 border border-sky-600 text-left whitespace-nowrap">UKPD</th>
                        <th className="px-2 py-2 border border-sky-600 text-left whitespace-nowrap">TMT JABATAN</th>
                        <th className="px-2 py-2 border border-sky-600 text-left whitespace-nowrap">LAMA</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-3 py-3 text-center text-slate-500 text-xs">
                            Tidak ada PNS pada UKPD ini.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row, idx) => {
                          const pangkatList = row.pangkat?.length
                            ? row.pangkat.map((p) => pangkatWithGol(p.pangkat)).filter(Boolean)
                            : [pangkatWithGol(row.pangkat_golongan)];
                          const tmtPangkatList = row.pangkat?.length
                            ? row.pangkat.map((p) => tglId(p.tmt))
                            : [tglId(row.tmt_pangkat_terakhir)];
                          const pendidikanList = row.pendidikan_formal?.length
                            ? row.pendidikan_formal.map(
                                (p) => `${p.tingkat || ''} - ${p.jurusan || ''} (${tglId(p.tanggal_ijazah)})`
                              )
                            : ['—'];
                          const diklatList = row.pendidikan_nonformal?.length
                            ? row.pendidikan_nonformal.map((p) => `- ${p.nama_pelatihan || ''} (${tglId(p.tanggal_ijazah)})`)
                            : ['—'];
                          const jabatanSorted = sortByDateDesc(row.jabatan);
                          const jabatanList = jabatanSorted.map((j) => `- ${j.jabatan || ''}`);
                          const ukpdList = jabatanSorted.map((j) => (j.lokasi ? `- ${j.lokasi}` : '-'));
                          const tmtJabatanList = jabatanSorted.map((j) => tglId(j.tmt));
                          const lamaList = jabatanSorted.map((j, i) => diffDuration(j.tmt, jabatanSorted[i - 1]?.tmt));
                          const jabatanNow = jabatanSorted[0]?.jabatan || row.nama_jabatan_orb || '—';
                          return (
                            <tr key={row.id_pegawai} className="hover:bg-slate-50">
                              <td className="px-2 py-2 border border-slate-200 text-center align-top">{idx + 1}</td>
                              <td className="px-2 py-2 border border-slate-200 align-top">
                                <span className="font-semibold text-slate-800">{row.nama || '—'}</span>
                                <br />
                                <span className="text-[10px] text-slate-600">
                                  {row.nrk || '—'} / {row.nip || '—'}
                                </span>
                                <br />
                                <span className="italic text-[10px] text-slate-700">{jabatanNow}</span>
                              </td>
                              <td className="px-2 py-2 border border-slate-200 align-top">
                                {pangkatList.length ? pangkatList.join('\n').split('\n').map((p, i) => (
                                  <div key={`pg-${i}`}>{p}</div>
                                )) : '—'}
                              </td>
                              <td className="px-2 py-2 border border-slate-200 align-top">
                                {tmtPangkatList.length ? tmtPangkatList.map((t, i) => <div key={`tmt-${i}`}>{t}</div>) : '—'}
                              </td>
                              <td className="px-2 py-2 border border-slate-200 align-top">
                                {pendidikanList.length ? pendidikanList.map((p, i) => <div key={`pf-${i}`}>{p}</div>) : '—'}
                              </td>
                              <td className="px-2 py-2 border border-slate-200 align-top">
                                {diklatList.length ? diklatList.map((d, i) => <div key={`dk-${i}`}>{d}</div>) : '—'}
                              </td>
                              <td className="px-2 py-2 border border-slate-200 align-top">
                                {jabatanList.length ? jabatanList.map((j, i) => <div key={`jb-${i}`}>{j}</div>) : '—'}
                              </td>
                              <td className="px-2 py-2 border border-slate-200 align-top">
                                {ukpdList.length ? ukpdList.map((u, i) => <div key={`uk-${i}`}>{u}</div>) : '—'}
                              </td>
                              <td className="px-2 py-2 border border-slate-200 align-top">
                                {tmtJabatanList.length ? tmtJabatanList.map((t, i) => <div key={`tj-${i}`}>{t}</div>) : '—'}
                              </td>
                              <td className="px-2 py-2 border border-slate-200 align-top">
                                {lamaList.length ? lamaList.map((t, i) => <div key={`lm-${i}`}>{t}</div>) : '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
