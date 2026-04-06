import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  createUsulanMutasi,
  getUkpd,
  getUsulanMutasi,
  logout,
} from '@/lib/api';
import { getStoredUser, normalizeRole, roleLabel } from '@/lib/auth';
import { navItems } from '@/lib/nav';

type MutasiRow = {
  id: number;
  nip: string;
  nama_pegawai: string;
  gelar_depan?: string | null;
  gelar_belakang?: string | null;
  pangkat_golongan?: string | null;
  jabatan?: string | null;
  abk_j_lama?: number | null;
  bezetting_j_lama?: number | null;
  nonasn_bezetting_lama?: number | null;
  nonasn_abk_lama?: number | null;
  jabatan_baru?: string | null;
  abk_j_baru?: number | null;
  bezetting_j_baru?: number | null;
  nonasn_bezetting_baru?: number | null;
  nonasn_abk_baru?: number | null;
  nama_ukpd?: string | null;
  ukpd_tujuan?: string | null;
  alasan: string;
  tanggal_usulan?: string | null;
  status?: string | null;
  berkas_path?: string | null;
  created_by_ukpd?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  keterangan?: string | null;
  mutasi_id?: number | null;
  jenis_mutasi?: string | null;
  verif_checklist?: string | null;
};

type UkpdOption = {
  id_ukpd?: string;
  nama_ukpd?: string;
  wilayah?: string | null;
};

type MutasiForm = {
  nip: string;
  nama_pegawai: string;
  gelar_depan: string;
  gelar_belakang: string;
  pangkat_golongan: string;
  jabatan: string;
  abk_j_lama: string;
  bezetting_j_lama: string;
  nonasn_bezetting_lama: string;
  nonasn_abk_lama: string;
  jabatan_baru: string;
  abk_j_baru: string;
  bezetting_j_baru: string;
  nonasn_bezetting_baru: string;
  nonasn_abk_baru: string;
  nama_ukpd: string;
  ukpd_tujuan: string;
  alasan: string;
  tanggal_usulan: string;
  status: string;
  berkas_path: string;
  created_by_ukpd: string;
  keterangan: string;
  mutasi_id: string;
  jenis_mutasi: string;
  verif_checklist: string;
};

const emptyForm = (createdByUkpd = ''): MutasiForm => ({
  nip: '',
  nama_pegawai: '',
  gelar_depan: '',
  gelar_belakang: '',
  pangkat_golongan: '',
  jabatan: '',
  abk_j_lama: '',
  bezetting_j_lama: '',
  nonasn_bezetting_lama: '',
  nonasn_abk_lama: '',
  jabatan_baru: '',
  abk_j_baru: '',
  bezetting_j_baru: '',
  nonasn_bezetting_baru: '',
  nonasn_abk_baru: '',
  nama_ukpd: createdByUkpd,
  ukpd_tujuan: '',
  alasan: '',
  tanggal_usulan: new Date().toISOString().slice(0, 16),
  status: 'DRAFT',
  berkas_path: '',
  created_by_ukpd: createdByUkpd,
  keterangan: '',
  mutasi_id: '',
  jenis_mutasi: 'Mutasi',
  verif_checklist: '',
});

const statusOptions = ['DRAFT', 'DIAJUKAN', 'DIVERIFIKASI', 'DITOLAK', 'DISETUJUI'];

const toInputDateTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('id-ID');
};

const buildDisplayName = (row: MutasiRow) =>
  [row.gelar_depan, row.nama_pegawai, row.gelar_belakang].filter(Boolean).join(' ');

export default function UsulanMutasiPage() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser());
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<MutasiRow[]>([]);
  const [ukpdOptions, setUkpdOptions] = useState<UkpdOption[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [statusText, setStatusText] = useState('Memuat usulan mutasi...');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<MutasiForm>(emptyForm(user?.nama_ukpd || ''));

  const role = normalizeRole(user?.role);
  const isReady = mounted && !!user;
  const displayRole = mounted ? roleLabel(user?.role) : 'Pengguna';
  const displayUkpd = mounted ? user?.nama_ukpd || 'Pengguna' : 'Pengguna';

  const menuItems = useMemo(
    () =>
      navItems.filter((item) => {
        if (!item.roles || item.roles.length === 0) return true;
        return item.roles.includes(role);
      }),
    [role]
  );

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace('/');
      return;
    }
    setUser(stored);
    setForm(emptyForm(stored.nama_ukpd || ''));
  }, [router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const loadUkpd = async () => {
      try {
        const response = await getUkpd();
        const payload = response.data;
        const items = Array.isArray(payload) ? payload : payload?.rows || [];
        setUkpdOptions(items);
      } catch (error) {
        console.error(error);
      }
    };
    loadUkpd();
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const loadRows = async () => {
      setStatusText('Memuat usulan mutasi...');
      try {
        const params: Record<string, any> = {
          limit: 300,
        };
        if (statusFilter) params.status = statusFilter;
        if (search.trim()) params.q = search.trim();
        if (role === 'ukpd' && user.nama_ukpd) {
          params.created_by_ukpd = user.nama_ukpd;
        }

        const response = await getUsulanMutasi(params);
        const payload = response.data || {};
        if (!active) return;
        setRows(Array.isArray(payload.rows) ? payload.rows : []);
        setStatusText(`Data dimuat: ${(payload.total || 0).toLocaleString('id-ID')} usulan.`);
      } catch (error: any) {
        if (!active) return;
        setStatusText(`Gagal memuat data: ${error?.response?.data?.error || error?.message || 'Unknown error'}`);
      }
    };

    loadRows();
    return () => {
      active = false;
    };
  }, [user, role, statusFilter, search]);

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

  const filteredStats = useMemo(() => {
    return statusOptions.reduce((acc, key) => {
      acc[key] = rows.filter((row) => (row.status || '').toUpperCase() === key).length;
      return acc;
    }, {} as Record<string, number>);
  }, [rows]);
  const mutasiApiUnavailable = statusText.toLowerCase().includes('endpoint usulan mutasi belum tersedia');

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleFormChange = (field: keyof MutasiForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const openCreateModal = () => {
    setForm(emptyForm(user?.nama_ukpd || ''));
    setModalOpen(true);
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createUsulanMutasi({
        ...form,
        created_by_ukpd: form.created_by_ukpd || user?.nama_ukpd || '',
        nama_ukpd: form.nama_ukpd || user?.nama_ukpd || '',
        tanggal_usulan: form.tanggal_usulan ? new Date(form.tanggal_usulan).toISOString().slice(0, 19).replace('T', ' ') : null,
      });
      setModalOpen(false);
      setForm(emptyForm(user?.nama_ukpd || ''));
      setSearch('');
      setStatusText('Usulan mutasi berhasil disimpan. Memuat ulang...');
      const response = await getUsulanMutasi({
        limit: 300,
        ...(role === 'ukpd' && user?.nama_ukpd ? { created_by_ukpd: user.nama_ukpd } : {}),
      });
      setRows(response.data?.rows || []);
      setStatusText(`Data dimuat: ${(response.data?.total || 0).toLocaleString('id-ID')} usulan.`);
    } catch (error: any) {
      setStatusText(`Gagal menyimpan: ${error?.response?.data?.error || error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>Usulan Mutasi</title>
        <link rel="icon" href="/foto/Dinkes.png" />
      </Head>

      <div className="pegawai-page">
        {sidebarOpen ? (
          <div id="sidebarBackdrop" className="show" onClick={() => setSidebarOpen(false)} />
        ) : null}
        <button type="button" className="mobile-toggle" aria-label="Buka menu" onClick={() => setSidebarOpen((prev) => !prev)}>
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
                  if (item.children?.length) {
                    return (
                      <div key={item.id}>
                        <div className="nav-title">{item.label}</div>
                        {item.children.map((child) => {
                          const path = navPath(child.id);
                          return (
                            <Link key={child.id} href={path} className={`nav-item ${router.pathname === path ? 'active' : ''}`}>
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
                    <Link key={item.id} href={path} className={`nav-item ${router.pathname === path ? 'active' : ''}`}>
                      <span className="icon-round">{renderIcon(item.icon)}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
            </nav>
            <div className="sidebar-footer">
              <div className="footer-title">Akses Login</div>
              <div className="footer-name" suppressHydrationWarning>{displayUkpd}</div>
              <div className="footer-role" suppressHydrationWarning>{displayRole}</div>
              <button type="button" className="ghost-btn" onClick={handleLogout}>Logout</button>
            </div>
          </aside>

          <div className="content">
            <header className="topbar">
              <div className="toolbar">
                <span className="badge" suppressHydrationWarning>{displayRole.toUpperCase()}</span>
                <span className="badge secondary" suppressHydrationWarning>{displayUkpd}</span>
              </div>
              <button type="button" className="danger-btn" onClick={handleLogout}>Keluar</button>
            </header>

            <main className="px-4 py-4 bg-slate-50 min-h-screen">
              <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {statusOptions.map((item) => (
                  <div key={item} className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
                    <div className="text-sm font-semibold text-slate-800 mt-1">{item}</div>
                    <div className="text-3xl font-bold text-sky-600 mt-3">{filteredStats[item] || 0}</div>
                  </div>
                ))}
              </section>

              <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 mt-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Daftar Usulan Mutasi</div>
                    <div className="text-xs text-slate-500 mt-1">{statusText}</div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Cari NIP / Nama / UKPD..."
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Semua Status</option>
                      {statusOptions.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={openCreateModal}
                      disabled={mutasiApiUnavailable}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                        mutasiApiUnavailable ? 'bg-slate-400 cursor-not-allowed' : 'bg-sky-600'
                      }`}
                    >
                      Tambah Usulan
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto mt-4">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="px-3 py-2 text-left">Tanggal</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">NIP / Nama</th>
                        <th className="px-3 py-2 text-left">UKPD Asal</th>
                        <th className="px-3 py-2 text-left">UKPD Tujuan</th>
                        <th className="px-3 py-2 text-left">Jabatan</th>
                        <th className="px-3 py-2 text-left">Jenis</th>
                        <th className="px-3 py-2 text-left">Dibuat Oleh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                            {mutasiApiUnavailable ? statusText : 'Belum ada usulan mutasi.'}
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => (
                          <tr key={row.id} className="border-b border-slate-100 align-top">
                            <td className="px-3 py-3 whitespace-nowrap">{formatDateTime(row.tanggal_usulan || row.created_at)}</td>
                            <td className="px-3 py-3">
                              <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                                {row.status || '-'}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-semibold text-slate-800">{buildDisplayName(row) || '-'}</div>
                              <div className="text-xs text-slate-500">{row.nip || '-'}</div>
                            </td>
                            <td className="px-3 py-3">{row.nama_ukpd || '-'}</td>
                            <td className="px-3 py-3">{row.ukpd_tujuan || '-'}</td>
                            <td className="px-3 py-3">
                              <div>{row.jabatan || '-'}</div>
                              <div className="text-xs text-slate-500 mt-1">Tujuan: {row.jabatan_baru || '-'}</div>
                            </td>
                            <td className="px-3 py-3">{row.jenis_mutasi || '-'}</td>
                            <td className="px-3 py-3">{row.created_by_ukpd || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </main>
          </div>
        </div>

        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
            <div className="w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Tambah Usulan Mutasi</h2>
                  <p className="text-sm text-slate-500 mt-1">Sesuai struktur tabel usulan mutasi yang Anda berikan.</p>
                </div>
                <button type="button" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" onClick={() => setModalOpen(false)}>
                  Tutup
                </button>
              </div>

              <form onSubmit={submitForm} className="space-y-6 mt-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">NIP</label>
                    <input required value={form.nip} onChange={(e) => handleFormChange('nip', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Pegawai</label>
                    <input required value={form.nama_pegawai} onChange={(e) => handleFormChange('nama_pegawai', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Gelar Depan</label>
                    <input value={form.gelar_depan} onChange={(e) => handleFormChange('gelar_depan', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Gelar Belakang</label>
                    <input value={form.gelar_belakang} onChange={(e) => handleFormChange('gelar_belakang', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Pangkat / Golongan</label>
                    <input value={form.pangkat_golongan} onChange={(e) => handleFormChange('pangkat_golongan', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Jabatan Lama</label>
                    <input value={form.jabatan} onChange={(e) => handleFormChange('jabatan', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Jabatan Baru</label>
                    <input value={form.jabatan_baru} onChange={(e) => handleFormChange('jabatan_baru', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Mutasi</label>
                    <input value={form.jenis_mutasi} onChange={(e) => handleFormChange('jenis_mutasi', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    ['abk_j_lama', 'ABK J Lama'],
                    ['bezetting_j_lama', 'Bezetting J Lama'],
                    ['nonasn_abk_lama', 'Non ASN ABK Lama'],
                    ['nonasn_bezetting_lama', 'Non ASN Bezetting Lama'],
                    ['abk_j_baru', 'ABK J Baru'],
                    ['bezetting_j_baru', 'Bezetting J Baru'],
                    ['nonasn_abk_baru', 'Non ASN ABK Baru'],
                    ['nonasn_bezetting_baru', 'Non ASN Bezetting Baru'],
                  ].map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                      <input
                        type="number"
                        min="0"
                        value={form[field as keyof MutasiForm]}
                        onChange={(e) => handleFormChange(field as keyof MutasiForm, e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">UKPD Asal</label>
                    <select value={form.nama_ukpd} onChange={(e) => handleFormChange('nama_ukpd', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                      <option value="">Pilih UKPD Asal</option>
                      {ukpdOptions.map((option) => (
                        <option key={`${option.nama_ukpd}-${option.wilayah || ''}`} value={option.nama_ukpd}>
                          {option.nama_ukpd}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">UKPD Tujuan</label>
                    <select value={form.ukpd_tujuan} onChange={(e) => handleFormChange('ukpd_tujuan', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                      <option value="">Pilih UKPD Tujuan</option>
                      {ukpdOptions.map((option) => (
                        <option key={`tujuan-${option.nama_ukpd}-${option.wilayah || ''}`} value={option.nama_ukpd}>
                          {option.nama_ukpd}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Usulan</label>
                    <input type="datetime-local" value={toInputDateTime(form.tanggal_usulan)} onChange={(e) => handleFormChange('tanggal_usulan', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select value={form.status} onChange={(e) => handleFormChange('status', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                      {statusOptions.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Created By UKPD</label>
                    <input value={form.created_by_ukpd} onChange={(e) => handleFormChange('created_by_ukpd', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mutasi ID</label>
                    <input value={form.mutasi_id} onChange={(e) => handleFormChange('mutasi_id', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Berkas Path</label>
                    <input value={form.berkas_path} onChange={(e) => handleFormChange('berkas_path', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Alasan</label>
                  <textarea required value={form.alasan} onChange={(e) => handleFormChange('alasan', e.target.value)} rows={4} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan</label>
                    <textarea value={form.keterangan} onChange={(e) => handleFormChange('keterangan', e.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Verif Checklist</label>
                    <textarea value={form.verif_checklist} onChange={(e) => handleFormChange('verif_checklist', e.target.value)} rows={3} placeholder='Contoh JSON atau catatan checklist verifikasi' className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button type="button" className="rounded-xl border border-slate-300 px-4 py-2 text-sm" onClick={() => setModalOpen(false)}>
                    Batal
                  </button>
                  <button type="submit" disabled={saving} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    {saving ? 'Menyimpan...' : 'Simpan Usulan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
