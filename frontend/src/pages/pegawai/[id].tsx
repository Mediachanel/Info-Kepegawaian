import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { getPegawaiById, logout } from '@/lib/api';
import { getStoredUser, normalizeRole, roleLabel } from '@/lib/auth';
import { navItems } from '@/lib/nav';

type PegawaiDetail = {
  id_pegawai?: string | number;
  nama?: string;
  nip?: string;
  nrk?: string;
  nik?: string;
  nama_ukpd?: string;
  jenis_pegawai?: string;
  status_rumpun?: string;
  kondisi?: string;
  nama_jabatan_orb?: string;
  nama_jabatan_menpan?: string;
  jenis_kelamin?: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  agama?: string;
  status_perkawinan?: string;
  no_hp_pegawai?: string;
  email?: string;
  no_bpjs?: string;
  pangkat_golongan?: string;
  tmt_pangkat_terakhir?: string;
  jenjang_pendidikan?: string;
  program_studi?: string;
  nama_universitas?: string;
  tmt_kerja_ukpd?: string;
  alamat?: Array<{
    tipe?: string;
    jalan?: string;
    kelurahan?: string;
    kecamatan?: string;
    kota_kabupaten?: string;
    provinsi?: string;
  }>;
  pasangan?: {
    status_punya?: string;
    nama?: string;
    no_tlp?: string;
    email?: string;
    pekerjaan?: string;
    tempat_lahir?: string;
    tanggal_lahir?: string;
    jenis_kelamin?: string;
    tunjangan?: number | string;
  } | null;
  anak?: Array<{
    urutan?: number;
    nama?: string;
    jenis_kelamin?: string;
    tempat_lahir?: string;
    tanggal_lahir?: string;
    pekerjaan?: string;
  }>;
  gaji_pokok?: Array<{
    tmt?: string;
    pangkat?: string;
    gaji?: number | string;
    no_sk?: string;
    tanggal_sk?: string;
  }>;
  hukuman_disiplin?: Array<{
    tanggal_mulai?: string;
    tanggal_akhir?: string;
    jenis_hukuman?: string;
    no_sk?: string;
    tanggal_sk?: string;
    keterangan?: string;
  }>;
  jabatan_fungsional?: Array<{
    tmt?: string;
    jabatan?: string;
    pangkat?: string;
    no_sk?: string;
    tanggal_sk?: string;
  }>;
  jabatan_struktural?: Array<{
    tmt?: string;
    lokasi?: string;
    jabatan?: string;
    pangkat?: string;
    eselon?: string;
    no_sk?: string;
    tanggal_sk?: string;
  }>;
  pangkat?: Array<{
    tmt?: string;
    pangkat?: string;
    lokasi?: string;
    no_sk?: string;
    tanggal_sk?: string;
  }>;
  pendidikan_formal?: Array<{
    tingkat?: string;
    jurusan?: string;
    tanggal_ijazah?: string;
    nama_sekolah?: string;
    kota?: string;
  }>;
  pendidikan_nonformal?: Array<{
    nama_pelatihan?: string;
    tanggal_ijazah?: string;
    penyelenggara?: string;
    kota?: string;
  }>;
  penghargaan?: Array<{
    nama_penghargaan?: string;
    asal_penghargaan?: string;
    no_sk?: string;
    tanggal_sk?: string;
  }>;
  skp?: Array<{
    tahun?: number | string;
    nilai_skp?: number | string;
    nilai_perilaku?: number | string;
    nilai_prestasi?: number | string;
    keterangan?: string;
  }>;
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const joinAddress = (row?: PegawaiDetail['alamat'][number]) => {
  if (!row) return '-';
  const parts = [
    row.jalan,
    row.kelurahan,
    row.kecamatan,
    row.kota_kabupaten,
    row.provinsi,
  ].filter((val) => val && String(val).trim());
  return parts.length ? parts.join(' - ') : '-';
};

const formatNumber = (value?: number | string | null) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString('id-ID');
};

const formatText = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};

const pickLatestTmt = (rows?: Array<{ tmt?: string }>) => {
  if (!rows || rows.length === 0) return '';
  let best = '';
  let bestTime = 0;
  for (const row of rows) {
    if (!row?.tmt) continue;
    const time = new Date(row.tmt).getTime();
    if (!Number.isNaN(time) && time > bestTime) {
      bestTime = time;
      best = row.tmt;
    }
  }
  return best;
};

export default function PegawaiProfilePage() {
  const router = useRouter();
  const { id } = router.query;
  const [user, setUser] = useState(getStoredUser());
  const [mounted, setMounted] = useState(false);
  const [detail, setDetail] = useState<PegawaiDetail | null>(null);
  const [statusText, setStatusText] = useState('memuat data...');
  const [showSections, setShowSections] = useState<string[]>([]);
  const [sectionsInitialized, setSectionsInitialized] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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
  const tmtUkpdFallback = useMemo(() => {
    const latestStr = pickLatestTmt(detail?.jabatan_struktural);
    const latestFun = pickLatestTmt(detail?.jabatan_fungsional);
    const candidates = [latestStr, latestFun].filter(Boolean);
    if (!candidates.length) return '';
    return candidates.reduce((acc, cur) => {
      const accTime = new Date(acc).getTime();
      const curTime = new Date(cur).getTime();
      return curTime > accTime ? cur : acc;
    });
  }, [detail?.jabatan_struktural, detail?.jabatan_fungsional]);

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
    if (!id) return;
    setSectionsInitialized(false);
    setShowSections([]);
    let active = true;
    const loadDetail = async () => {
      setStatusText('memuat data...');
      try {
        const response = await getPegawaiById(id as string);
        if (!active) return;
        setDetail(response.data);
        setStatusText('data siap.');
      } catch (err: any) {
        if (!active) return;
        const message = err?.response?.data?.error || err?.message || 'Gagal memuat profil';
        setStatusText(`gagal: ${message}`);
      }
    };
    loadDetail();
    return () => {
      active = false;
    };
  }, [id]);

  const sections = useMemo(
    () => [
      { id: 'alamat', label: 'Alamat', count: detail?.alamat?.length || 0 },
      { id: 'pasangan', label: 'Pasangan', count: detail?.pasangan ? 1 : 0 },
      { id: 'anak', label: 'Anak', count: detail?.anak?.length || 0 },
      { id: 'pendidikan-formal', label: 'Pendidikan Formal', count: detail?.pendidikan_formal?.length || 0 },
      { id: 'pendidikan-nonformal', label: 'Pendidikan Nonformal', count: detail?.pendidikan_nonformal?.length || 0 },
      { id: 'pangkat', label: 'Riwayat Pangkat', count: detail?.pangkat?.length || 0 },
      { id: 'jabatan-fungsional', label: 'Jabatan Fungsional', count: detail?.jabatan_fungsional?.length || 0 },
      { id: 'jabatan-struktural', label: 'Jabatan Struktural', count: detail?.jabatan_struktural?.length || 0 },
      { id: 'gaji-pokok', label: 'Gaji Pokok', count: detail?.gaji_pokok?.length || 0 },
      { id: 'hukuman-disiplin', label: 'Hukuman Disiplin', count: detail?.hukuman_disiplin?.length || 0 },
      { id: 'penghargaan', label: 'Penghargaan', count: detail?.penghargaan?.length || 0 },
      { id: 'skp', label: 'SKP', count: detail?.skp?.length || 0 },
    ],
    [detail]
  );

  const filteredSections = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return sections;
    return sections.filter((section) => section.label.toLowerCase().includes(term));
  }, [sections, searchTerm]);

  useEffect(() => {
    if (!detail || sectionsInitialized || sections.length === 0) return;
    setShowSections(sections.map((section) => section.id));
    setSectionsInitialized(true);
  }, [detail, sections, sectionsInitialized]);

  const toggleSection = (id: string) => {
    setShowSections((prev) =>
      prev.includes(id) ? prev.filter((key) => key !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (showSections.length === sections.length) {
      setShowSections([]);
    } else {
      setShowSections(sections.map((section) => section.id));
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const renderTable = (
    rows: Array<Record<string, any>> | undefined,
    columns: Array<{ key: string; label: string; format?: (value: any) => string }>,
    emptyText: string
  ) => {
    if (!rows || rows.length === 0) {
      return <p>{emptyText}</p>;
    }
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={`${rowIdx}-${columns[0]?.key || 'row'}`}>
                {columns.map((col) => {
                  const raw = row[col.key];
                  const value = col.format ? col.format(raw) : formatText(raw);
                  return <td key={`${rowIdx}-${col.key}`}>{value}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>Profil Pegawai</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/foto/Dinkes.png" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="pegawai-page pegawai-profile">
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

            <main className="profile-content">
          <div className="profile-header">
            <div>
              <h1>Profil Pegawai</h1>
              <p>Status: {statusText}</p>
            </div>
            <div className="profile-header-actions">
              <Link href="/pegawai" className="ghost-btn">
                Kembali ke Data Pegawai
              </Link>
              <button type="button" className="ghost-btn" onClick={() => window.print()}>
                Cetak
              </button>
            </div>
          </div>

          <section className="profile-card">
            <div className="profile-card-header">
              <div className="photo">
                <span>User</span>
              </div>
              <div className="profile-main">
                <h2>{detail?.nama || '-'}</h2>
                <div className="meta">
                  <span>NRK: {detail?.nrk || '-'}</span>
                  <span>NIP: {detail?.nip || '-'}</span>
                  <span>NIK: {detail?.nik || '-'}</span>
                </div>
              </div>
            </div>

            <div className="profile-grid">
              <div>
                <h3>Identitas</h3>
                <ul>
                  <li>Jenis Kelamin: {detail?.jenis_kelamin || '-'}</li>
                  <li>
                    Tempat, Tgl Lahir: {detail?.tempat_lahir || '-'} -{' '}
                    {formatDate(detail?.tanggal_lahir)}
                  </li>
                  <li>Agama: {detail?.agama || '-'}</li>
                  <li>Status Perkawinan: {detail?.status_perkawinan || '-'}</li>
                </ul>
              </div>
              <div>
                <h3>Kepegawaian</h3>
                <ul>
                  <li>UKPD: {detail?.nama_ukpd || '-'}</li>
                  <li>Jabatan ORB: {detail?.nama_jabatan_orb || '-'}</li>
                  <li>Jabatan Menpan: {detail?.nama_jabatan_menpan || '-'}</li>
                  <li>Jenis Pegawai: {detail?.jenis_pegawai || '-'}</li>
                  <li>Status Rumpun: {detail?.status_rumpun || '-'}</li>
                  <li>Kondisi: {detail?.kondisi || '-'}</li>
                  <li>
                    TMT UKPD: {formatDate(detail?.tmt_kerja_ukpd || tmtUkpdFallback)} - TMT Pangkat:{' '}
                    {formatDate(detail?.tmt_pangkat_terakhir)}
                  </li>
                </ul>
              </div>
              <div>
                <h3>Pendidikan</h3>
                <ul>
                  <li>Jenjang: {detail?.jenjang_pendidikan || '-'}</li>
                  <li>Program Studi: {detail?.program_studi || '-'}</li>
                  <li>Universitas: {detail?.nama_universitas || '-'}</li>
                </ul>
              </div>
              <div>
                <h3>Kontak</h3>
                <ul>
                  <li>No HP: {detail?.no_hp_pegawai || '-'}</li>
                  <li>Email: {detail?.email || '-'}</li>
                  <li>No BPJS: {detail?.no_bpjs || '-'}</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="profile-card">
            <div className="dropdown-row">
              <div className="dropdown">
                <button
                  type="button"
                  className="dropdown-trigger"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                >
                  <span>
                    {showSections.length
                      ? `${showSections.length} riwayat dipilih`
                      : 'Pilih Riwayat'}
                  </span>
                  <span aria-hidden="true">v</span>
                </button>
                {dropdownOpen && (
                  <div className="dropdown-panel">
                    <div className="dropdown-search">
                      <input
                        placeholder="Cari..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                      />
                    </div>
                    <div className="dropdown-stats">
                      <span className="stat-chip">Terpilih {showSections.length}</span>
                      <span className="stat-chip">Total {sections.length}</span>
                    </div>
                    <button type="button" className="dropdown-all" onClick={toggleAll}>
                      Pilih Semua / Hapus Semua
                    </button>
                    <div className="dropdown-list">
                      {filteredSections.map((section) => (
                        <label
                          key={section.id}
                          className={`dropdown-item ${showSections.includes(section.id) ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={showSections.includes(section.id)}
                            onChange={() => toggleSection(section.id)}
                          />
                          <span>{section.label}</span>
                          <span className="count">{section.count}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button type="button" className="ghost-btn" onClick={() => setDropdownOpen(false)}>
                Sembunyikan
              </button>
            </div>
          </section>

          <div className="profile-sections">
            {showSections.includes('alamat') && (
              <section className="profile-card">
                <h3>Alamat</h3>
                <div className="grid">
                  {detail?.alamat?.length ? (
                    detail.alamat.map((alamat, index) => (
                      <div key={`${alamat.tipe}-${index}`} className="info-card">
                        <h4>{alamat.tipe || 'Alamat'}</h4>
                        <p>{joinAddress(alamat)}</p>
                      </div>
                    ))
                  ) : (
                    <p>Tidak ada data alamat.</p>
                  )}
                </div>
              </section>
            )}

            {showSections.includes('pasangan') && (
              <section className="profile-card">
                <h3>Pasangan</h3>
                {detail?.pasangan ? (
                  <div className="grid">
                    <div className="info-card">
                      <h4>{detail.pasangan.nama || '-'}</h4>
                      <p>Status: {detail.pasangan.status_punya || '-'}</p>
                      <p>No HP: {detail.pasangan.no_tlp || '-'}</p>
                      <p>Email: {detail.pasangan.email || '-'}</p>
                      <p>
                        TTL: {detail.pasangan.tempat_lahir || '-'} - {formatDate(detail.pasangan.tanggal_lahir)}
                      </p>
                      <p>Jenis Kelamin: {detail.pasangan.jenis_kelamin || '-'}</p>
                      <p>Tunjangan: {detail.pasangan.tunjangan ? 'Dapat' : 'Tidak'}</p>
                      <p>Pekerjaan: {detail.pasangan.pekerjaan || '-'}</p>
                    </div>
                  </div>
                ) : (
                  <p>Tidak ada data pasangan.</p>
                )}
              </section>
            )}

            {showSections.includes('anak') && (
              <section className="profile-card">
                <h3>Anak</h3>
                <div className="grid">
                  {detail?.anak?.length ? (
                    detail.anak.map((anak, index) => (
                      <div key={`${anak.urutan}-${index}`} className="info-card">
                        <h4>{anak.nama || '-'}</h4>
                        <p>Urutan: {anak.urutan || '-'}</p>
                        <p>Jenis Kelamin: {anak.jenis_kelamin || '-'}</p>
                        <p>
                          TTL: {anak.tempat_lahir || '-'} - {formatDate(anak.tanggal_lahir)}
                        </p>
                        <p>Pekerjaan: {anak.pekerjaan || '-'}</p>
                      </div>
                    ))
                  ) : (
                    <p>Tidak ada data anak.</p>
                  )}
                </div>
              </section>
            )}

            {showSections.includes('pendidikan-formal') && (
              <section className="profile-card">
                <h3>Pendidikan Formal</h3>
                {renderTable(
                  detail?.pendidikan_formal,
                  [
                    { key: 'tingkat', label: 'Tingkat' },
                    { key: 'jurusan', label: 'Jurusan' },
                    { key: 'tanggal_ijazah', label: 'Tanggal Ijazah', format: formatDate },
                    { key: 'nama_sekolah', label: 'Nama Sekolah' },
                    { key: 'kota', label: 'Kota' },
                  ],
                  'Tidak ada data pendidikan formal.'
                )}
              </section>
            )}

            {showSections.includes('pendidikan-nonformal') && (
              <section className="profile-card">
                <h3>Pendidikan Nonformal</h3>
                {renderTable(
                  detail?.pendidikan_nonformal,
                  [
                    { key: 'nama_pelatihan', label: 'Pelatihan' },
                    { key: 'tanggal_ijazah', label: 'Tanggal Ijazah', format: formatDate },
                    { key: 'penyelenggara', label: 'Penyelenggara' },
                    { key: 'kota', label: 'Kota' },
                  ],
                  'Tidak ada data pendidikan nonformal.'
                )}
              </section>
            )}

            {showSections.includes('pangkat') && (
              <section className="profile-card">
                <h3>Riwayat Pangkat</h3>
                {renderTable(
                  detail?.pangkat,
                  [
                    { key: 'tmt', label: 'TMT', format: formatDate },
                    { key: 'pangkat', label: 'Pangkat' },
                    { key: 'lokasi', label: 'Lokasi' },
                    { key: 'no_sk', label: 'No SK' },
                    { key: 'tanggal_sk', label: 'Tanggal SK', format: formatDate },
                  ],
                  'Tidak ada data pangkat.'
                )}
              </section>
            )}

            {showSections.includes('jabatan-fungsional') && (
              <section className="profile-card">
                <h3>Jabatan Fungsional</h3>
                {renderTable(
                  detail?.jabatan_fungsional,
                  [
                    { key: 'tmt', label: 'TMT', format: formatDate },
                    { key: 'jabatan', label: 'Jabatan' },
                    { key: 'pangkat', label: 'Pangkat' },
                    { key: 'no_sk', label: 'No SK' },
                    { key: 'tanggal_sk', label: 'Tanggal SK', format: formatDate },
                  ],
                  'Tidak ada data jabatan fungsional.'
                )}
              </section>
            )}

            {showSections.includes('jabatan-struktural') && (
              <section className="profile-card">
                <h3>Jabatan Struktural</h3>
                {renderTable(
                  detail?.jabatan_struktural,
                  [
                    { key: 'tmt', label: 'TMT', format: formatDate },
                    { key: 'lokasi', label: 'Lokasi' },
                    { key: 'jabatan', label: 'Jabatan' },
                    { key: 'pangkat', label: 'Pangkat' },
                    { key: 'eselon', label: 'Eselon' },
                    { key: 'no_sk', label: 'No SK' },
                    { key: 'tanggal_sk', label: 'Tanggal SK', format: formatDate },
                  ],
                  'Tidak ada data jabatan struktural.'
                )}
              </section>
            )}

            {showSections.includes('gaji-pokok') && (
              <section className="profile-card">
                <h3>Gaji Pokok</h3>
                {renderTable(
                  detail?.gaji_pokok,
                  [
                    { key: 'tmt', label: 'TMT', format: formatDate },
                    { key: 'pangkat', label: 'Pangkat' },
                    { key: 'gaji', label: 'Gaji', format: formatNumber },
                    { key: 'no_sk', label: 'No SK' },
                    { key: 'tanggal_sk', label: 'Tanggal SK', format: formatDate },
                  ],
                  'Tidak ada data gaji pokok.'
                )}
              </section>
            )}

            {showSections.includes('hukuman-disiplin') && (
              <section className="profile-card">
                <h3>Hukuman Disiplin</h3>
                {renderTable(
                  detail?.hukuman_disiplin,
                  [
                    { key: 'tanggal_mulai', label: 'Mulai', format: formatDate },
                    { key: 'tanggal_akhir', label: 'Selesai', format: formatDate },
                    { key: 'jenis_hukuman', label: 'Jenis Hukuman' },
                    { key: 'no_sk', label: 'No SK' },
                    { key: 'tanggal_sk', label: 'Tanggal SK', format: formatDate },
                    { key: 'keterangan', label: 'Keterangan' },
                  ],
                  'Tidak ada data hukuman disiplin.'
                )}
              </section>
            )}

            {showSections.includes('penghargaan') && (
              <section className="profile-card">
                <h3>Penghargaan</h3>
                {renderTable(
                  detail?.penghargaan,
                  [
                    { key: 'nama_penghargaan', label: 'Nama Penghargaan' },
                    { key: 'asal_penghargaan', label: 'Asal Penghargaan' },
                    { key: 'no_sk', label: 'No SK' },
                    { key: 'tanggal_sk', label: 'Tanggal SK', format: formatDate },
                  ],
                  'Tidak ada data penghargaan.'
                )}
              </section>
            )}

            {showSections.includes('skp') && (
              <section className="profile-card">
                <h3>SKP</h3>
                {renderTable(
                  detail?.skp,
                  [
                    { key: 'tahun', label: 'Tahun' },
                    { key: 'nilai_skp', label: 'Nilai SKP', format: formatNumber },
                    { key: 'nilai_perilaku', label: 'Nilai Perilaku', format: formatNumber },
                    { key: 'nilai_prestasi', label: 'Nilai Prestasi', format: formatNumber },
                    { key: 'keterangan', label: 'Keterangan' },
                  ],
                  'Tidak ada data SKP.'
                )}
              </section>
            )}
          </div>
        </main>
        </div>
      </div>
    </div>
    </>
  );
}
