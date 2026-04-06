import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  createPegawai,
  getPegawai,
  getPegawaiById,
  getPegawaiFilters,
  getUkpd,
  logout,
  updatePegawai,
} from '@/lib/api';
import { getStoredUser, normalizeRole, roleLabel } from '@/lib/auth';
import { navItems } from '@/lib/nav';

type PegawaiRow = Record<string, any>;

type UkpdRow = {
  id_ukpd?: string;
  nama_ukpd?: string;
  wilayah?: string | null;
};

type Toast = { id: number; type: 'success' | 'error'; title: string; message: string };

const norm = (value: unknown) =>
  String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const createToast = (title: string, message: string, type: Toast['type']) => ({
  id: Date.now() + Math.floor(Math.random() * 1000),
  type,
  title,
  message,
});

const GENDER_OPTIONS = [
  { value: '', label: 'Pilih' },
  { value: 'L', label: 'Laki-laki (L)' },
  { value: 'P', label: 'Perempuan (P)' },
];

const STATUS_PEGAWAI_OPTIONS = [
  { value: '', label: 'Pilih' },
  { value: 'PNS', label: 'PNS' },
  { value: 'CPNS', label: 'CPNS' },
  { value: 'PPPK', label: 'PPPK' },
  { value: 'PPPK Paruh Waktu', label: 'PPPK Paruh Waktu' },
  { value: 'NON ASN', label: 'NON ASN' },
  { value: 'PJLP', label: 'PJLP' },
];

const KONDISI_OPTIONS = [
  { value: '', label: 'Pilih' },
  { value: 'AKTIF', label: 'AKTIF' },
  { value: 'PENSIUN', label: 'PENSIUN' },
  { value: 'RESIGN', label: 'RESIGN' },
  { value: 'MENINGGAL', label: 'MENINGGAL' },
  { value: 'CUTI', label: 'CUTI' },
];

const PERKAWINAN_OPTIONS = [
  { value: '', label: 'Pilih' },
  { value: 'BELUM MENIKAH', label: 'Belum Menikah' },
  { value: 'MENIKAH', label: 'Menikah' },
  { value: 'CERAI HIDUP', label: 'Cerai Hidup' },
  { value: 'CERAI MATI', label: 'Cerai Mati' },
];

const AGAMA_OPTIONS = [
  { value: '', label: 'Pilih' },
  { value: 'ISLAM', label: 'Islam' },
  { value: 'KRISTEN', label: 'Kristen' },
  { value: 'KATOLIK', label: 'Katolik' },
  { value: 'HINDU', label: 'Hindu' },
  { value: 'BUDDHA', label: 'Buddha' },
  { value: 'KONGHUCU', label: 'Konghucu' },
  { value: 'LAINNYA', label: 'Lainnya' },
];

const JENIS_KONTRAK_OPTIONS = [
  { value: '', label: 'Pilih' },
  { value: 'Full Time Tetap', label: 'Full Time Tetap' },
  { value: 'Kontrak', label: 'Kontrak' },
  { value: 'Paruh Waktu', label: 'Paruh Waktu' },
  { value: 'Honorer', label: 'Honorer' },
];

const PASANGAN_STATUS_OPTIONS = [
  { value: '', label: 'Pilih' },
  { value: 'YA', label: 'Ya' },
  { value: 'TIDAK', label: 'Tidak' },
];

const ALAMAT_TIPE_OPTIONS = [
  { value: '', label: 'Pilih' },
  { value: 'DOMISILI', label: 'Domisili' },
  { value: 'KTP', label: 'KTP' },
];

type PegawaiForm = {
  master: {
    nama_ukpd: string;
    nama: string;
    kondisi: string;
    nama_jabatan_orb: string;
    nama_jabatan_menpan: string;
    struktur_atasan_langsung: string;
    jenis_pegawai: string;
    status_rumpun: string;
    jenis_kontrak: string;
    nrk: string;
    nip: string;
    pangkat_golongan: string;
    tmt_pangkat_terakhir: string;
    jenis_kelamin: string;
    tmt_kerja_ukpd: string;
    tempat_lahir: string;
    tanggal_lahir: string;
    nik: string;
    agama: string;
    jenjang_pendidikan: string;
    program_studi: string;
    nama_universitas: string;
    no_hp_pegawai: string;
    email: string;
    no_bpjs: string;
    gelar_depan: string;
    gelar_belakang: string;
    status_perkawinan: string;
  };
  alamat: Array<{
    tipe: string;
    jalan: string;
    kelurahan: string;
    kecamatan: string;
    kota_kabupaten: string;
    provinsi: string;
    kode_provinsi: string;
    kode_kota_kab: string;
    kode_kecamatan: string;
    kode_kelurahan: string;
  }>;
  pasangan: {
    status_punya: string;
    nama: string;
    no_tlp: string;
    email: string;
    pekerjaan: string;
  };
  anak: Array<{
    urutan: string;
    nama: string;
    jenis_kelamin: string;
    tempat_lahir: string;
    tanggal_lahir: string;
    pekerjaan: string;
  }>;
  gaji_pokok: Array<{
    tmt: string;
    pangkat: string;
    gaji: string;
    no_sk: string;
    tanggal_sk: string;
  }>;
  hukuman_disiplin: Array<{
    tanggal_mulai: string;
    tanggal_akhir: string;
    jenis_hukuman: string;
    no_sk: string;
    tanggal_sk: string;
    keterangan: string;
  }>;
  jabatan_fungsional: Array<{
    tmt: string;
    jabatan: string;
    pangkat: string;
    no_sk: string;
    tanggal_sk: string;
  }>;
  jabatan_struktural: Array<{
    tmt: string;
    lokasi: string;
    jabatan: string;
    pangkat: string;
    eselon: string;
    no_sk: string;
    tanggal_sk: string;
  }>;
  pangkat: Array<{
    tmt: string;
    pangkat: string;
    lokasi: string;
    no_sk: string;
    tanggal_sk: string;
  }>;
  pendidikan_formal: Array<{
    tingkat: string;
    jurusan: string;
    tanggal_ijazah: string;
    nama_sekolah: string;
    kota: string;
  }>;
  pendidikan_nonformal: Array<{
    nama_pelatihan: string;
    tanggal_ijazah: string;
    penyelenggara: string;
    kota: string;
  }>;
  penghargaan: Array<{
    nama_penghargaan: string;
    asal_penghargaan: string;
    no_sk: string;
    tanggal_sk: string;
  }>;
  skp: Array<{
    tahun: string;
    nilai_skp: string;
    nilai_perilaku: string;
    nilai_prestasi: string;
    keterangan: string;
  }>;
};

const createEmptyForm = (): PegawaiForm => ({
  master: {
    nama_ukpd: '',
    nama: '',
    kondisi: '',
    nama_jabatan_orb: '',
    nama_jabatan_menpan: '',
    struktur_atasan_langsung: '',
    jenis_pegawai: '',
    status_rumpun: '',
    jenis_kontrak: '',
    nrk: '',
    nip: '',
    pangkat_golongan: '',
    tmt_pangkat_terakhir: '',
    jenis_kelamin: '',
    tmt_kerja_ukpd: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    nik: '',
    agama: '',
    jenjang_pendidikan: '',
    program_studi: '',
    nama_universitas: '',
    no_hp_pegawai: '',
    email: '',
    no_bpjs: '',
    gelar_depan: '',
    gelar_belakang: '',
    status_perkawinan: '',
  },
  alamat: [],
  pasangan: {
    status_punya: '',
    nama: '',
    no_tlp: '',
    email: '',
    pekerjaan: '',
  },
  anak: [],
  gaji_pokok: [],
  hukuman_disiplin: [],
  jabatan_fungsional: [],
  jabatan_struktural: [],
  pangkat: [],
  pendidikan_formal: [],
  pendidikan_nonformal: [],
  penghargaan: [],
  skp: [],
});

export default function PegawaiPage() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null);
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<PegawaiRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [ukpdRows, setUkpdRows] = useState<UkpdRow[]>([]);
  const [statusText, setStatusText] = useState('menunggu data...');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [jabatanFilter, setJabatanFilter] = useState('');
  const [activeStatuses, setActiveStatuses] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [jabatanOptions, setJabatanOptions] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [activePegawaiId, setActivePegawaiId] = useState<string | number | null>(null);
  const [formData, setFormData] = useState<PegawaiForm>(createEmptyForm());
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState({ csv: false });
  const [toasts, setToasts] = useState<Toast[]>([]);

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
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const loadFilters = async () => {
      const [ukpdResult, filterResult] = await Promise.allSettled([
        getUkpd(),
        getPegawaiFilters(),
      ]);

      if (!active) return;

      if (ukpdResult.status === 'fulfilled') {
        const raw = ukpdResult.value.data;
        const rows = Array.isArray(raw) ? raw : raw?.rows || [];
        setUkpdRows(rows);
      }

      if (filterResult.status === 'fulfilled') {
        const payload = filterResult.value.data || {};
        setJabatanOptions(Array.isArray(payload.jabatan) ? payload.jabatan : []);
        setStatusOptions(Array.isArray(payload.status) ? payload.status : []);
      }
    };

    loadFilters();

    return () => {
      active = false;
    };
  }, [user]);

  const role = normalizeRole(user?.role);

  const menuItems = useMemo(() => {
    return navItems.filter((item) => {
      if (!item.roles || item.roles.length === 0) return true;
      return item.roles.includes(role);
    });
  }, [role]);

  const displayRole = mounted ? roleLabel(role) : 'Pengguna';
  const displayUkpd = mounted ? user?.nama_ukpd || 'Pengguna' : 'Pengguna';
  const isReady = mounted && !!user;

  const navPath = (id: string) => {
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
    return map[id] || '#';
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

  const unitOptions = useMemo(() => {
    let options = ukpdRows;
    if (role === 'wilayah' && user?.wilayah) {
      const wilayahKey = norm(user.wilayah);
      options = options.filter((row) => norm(row.wilayah) === wilayahKey);
    }
    return Array.from(new Set(options.map((row) => row.nama_ukpd).filter(Boolean))).sort();
  }, [ukpdRows, role, user]);

  const unitSelectDisabled = role === 'ukpd';

  useEffect(() => {
    if (unitSelectDisabled && user?.nama_ukpd) {
      setUnitFilter(user.nama_ukpd);
    }
  }, [unitSelectDisabled, user]);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const loadPage = async () => {
      setStatusText('Memuat data pegawai...');
      try {
        const offset = (currentPage - 1) * pageSize;
        const params: NonNullable<Parameters<typeof getPegawai>[0]> = {
          limit: pageSize,
          offset,
          lite: 1,
        };
        if (debouncedSearch) params.search = debouncedSearch;
        if (jabatanFilter) params.jabatan = jabatanFilter;
        if (activeStatuses.length) params.status = activeStatuses.join(',');
        if (unitSelectDisabled && user?.nama_ukpd) {
          params.unit = user.nama_ukpd;
        } else if (unitFilter) {
          params.unit = unitFilter;
        } else if (role === 'wilayah' && user?.wilayah) {
          params.wilayah = user.wilayah;
        }

        const response = await getPegawai(params);
        const payload = response.data;
        const pageRows = Array.isArray(payload) ? payload : payload?.rows || [];
        const total = Number(payload?.total) || pageRows.length;
        if (!active) return;
        setRows(pageRows);
        setTotalRows(total);
        setStatusText(`Data dimuat: ${total.toLocaleString('id-ID')} baris.`);
      } catch (err: any) {
        if (!active) return;
        const message = err?.message || 'Gagal mengambil data pegawai';
        setStatusText(`Gagal ambil data: ${message}`);
      }
    };

    loadPage();

    return () => {
      active = false;
    };
  }, [
    user,
    role,
    pageSize,
    currentPage,
    debouncedSearch,
    unitFilter,
    jabatanFilter,
    activeStatuses,
    unitSelectDisabled,
    reloadKey,
  ]);

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pagedRows = rows;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  const addToast = (title: string, message: string, type: Toast['type']) => {
    const toast = createToast(title, message, type);
    setToasts((prev) => [...prev, toast]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== toast.id));
    }, 2600);
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleStatusToggle = (status: string) => {
    setCurrentPage(1);
    setActiveStatuses((prev) => {
      if (prev.includes(status)) return prev.filter((item) => item !== status);
      return [...prev, status];
    });
  };

  const handleReset = () => {
    setSearch('');
    if (unitSelectDisabled && user?.nama_ukpd) {
      setUnitFilter(user.nama_ukpd);
    } else {
      setUnitFilter('');
    }
    setJabatanFilter('');
    setActiveStatuses([]);
    setCurrentPage(1);
  };

  const toInputDate = (value: any) => {
    if (!value) return '';
    const text = String(value);
    return text.length >= 10 ? text.slice(0, 10) : text;
  };

  const openCreateModal = () => {
    setModalMode('create');
    setActivePegawaiId(null);
    setFormData(createEmptyForm());
    setModalOpen(true);
  };

  const openEditModal = async (id: number | string) => {
    setModalMode('edit');
    setActivePegawaiId(id);
    setModalOpen(true);
    try {
      const response = await getPegawaiById(id);
      const detail = response.data || {};
      setFormData({
        master: {
          nama_ukpd: detail.nama_ukpd || '',
          nama: detail.nama || '',
          kondisi: detail.kondisi || '',
          nama_jabatan_orb: detail.nama_jabatan_orb || '',
          nama_jabatan_menpan: detail.nama_jabatan_menpan || '',
          struktur_atasan_langsung: detail.struktur_atasan_langsung || '',
          jenis_pegawai: detail.jenis_pegawai || '',
          status_rumpun: detail.status_rumpun || '',
          jenis_kontrak: detail.jenis_kontrak || '',
          nrk: detail.nrk || '',
          nip: detail.nip || '',
          pangkat_golongan: detail.pangkat_golongan || '',
          tmt_pangkat_terakhir: toInputDate(detail.tmt_pangkat_terakhir),
          jenis_kelamin: detail.jenis_kelamin || '',
          tmt_kerja_ukpd: toInputDate(detail.tmt_kerja_ukpd),
          tempat_lahir: detail.tempat_lahir || '',
          tanggal_lahir: toInputDate(detail.tanggal_lahir),
          nik: detail.nik || '',
          agama: detail.agama || '',
          jenjang_pendidikan: detail.jenjang_pendidikan || '',
          program_studi: detail.program_studi || '',
          nama_universitas: detail.nama_universitas || '',
          no_hp_pegawai: detail.no_hp_pegawai || '',
          email: detail.email || '',
          no_bpjs: detail.no_bpjs || '',
          gelar_depan: detail.gelar_depan || '',
          gelar_belakang: detail.gelar_belakang || '',
          status_perkawinan: detail.status_perkawinan || '',
        },
        alamat: Array.isArray(detail.alamat)
          ? detail.alamat.map((row: any) => ({
              tipe: row.tipe || '',
              jalan: row.jalan || '',
              kelurahan: row.kelurahan || '',
              kecamatan: row.kecamatan || '',
              kota_kabupaten: row.kota_kabupaten || '',
              provinsi: row.provinsi || '',
              kode_provinsi: row.kode_provinsi || '',
              kode_kota_kab: row.kode_kota_kab || '',
              kode_kecamatan: row.kode_kecamatan || '',
              kode_kelurahan: row.kode_kelurahan || '',
            }))
          : [],
        pasangan: {
          status_punya: detail.pasangan?.status_punya || '',
          nama: detail.pasangan?.nama || '',
          no_tlp: detail.pasangan?.no_tlp || '',
          email: detail.pasangan?.email || '',
          pekerjaan: detail.pasangan?.pekerjaan || '',
        },
        anak: Array.isArray(detail.anak)
          ? detail.anak.map((row: any) => ({
              urutan: row.urutan ? String(row.urutan) : '',
              nama: row.nama || '',
              jenis_kelamin: row.jenis_kelamin || '',
              tempat_lahir: row.tempat_lahir || '',
              tanggal_lahir: toInputDate(row.tanggal_lahir),
              pekerjaan: row.pekerjaan || '',
            }))
          : [],
        gaji_pokok: Array.isArray(detail.gaji_pokok)
          ? detail.gaji_pokok.map((row: any) => ({
              tmt: toInputDate(row.tmt),
              pangkat: row.pangkat || '',
              gaji: row.gaji ? String(row.gaji) : '',
              no_sk: row.no_sk || '',
              tanggal_sk: toInputDate(row.tanggal_sk),
            }))
          : [],
        hukuman_disiplin: Array.isArray(detail.hukuman_disiplin)
          ? detail.hukuman_disiplin.map((row: any) => ({
              tanggal_mulai: toInputDate(row.tanggal_mulai),
              tanggal_akhir: toInputDate(row.tanggal_akhir),
              jenis_hukuman: row.jenis_hukuman || '',
              no_sk: row.no_sk || '',
              tanggal_sk: toInputDate(row.tanggal_sk),
              keterangan: row.keterangan || '',
            }))
          : [],
        jabatan_fungsional: Array.isArray(detail.jabatan_fungsional)
          ? detail.jabatan_fungsional.map((row: any) => ({
              tmt: toInputDate(row.tmt),
              jabatan: row.jabatan || '',
              pangkat: row.pangkat || '',
              no_sk: row.no_sk || '',
              tanggal_sk: toInputDate(row.tanggal_sk),
            }))
          : [],
        jabatan_struktural: Array.isArray(detail.jabatan_struktural)
          ? detail.jabatan_struktural.map((row: any) => ({
              tmt: toInputDate(row.tmt),
              lokasi: row.lokasi || '',
              jabatan: row.jabatan || '',
              pangkat: row.pangkat || '',
              eselon: row.eselon || '',
              no_sk: row.no_sk || '',
              tanggal_sk: toInputDate(row.tanggal_sk),
            }))
          : [],
        pangkat: Array.isArray(detail.pangkat)
          ? detail.pangkat.map((row: any) => ({
              tmt: toInputDate(row.tmt),
              pangkat: row.pangkat || '',
              lokasi: row.lokasi || '',
              no_sk: row.no_sk || '',
              tanggal_sk: toInputDate(row.tanggal_sk),
            }))
          : [],
        pendidikan_formal: Array.isArray(detail.pendidikan_formal)
          ? detail.pendidikan_formal.map((row: any) => ({
              tingkat: row.tingkat || '',
              jurusan: row.jurusan || '',
              tanggal_ijazah: toInputDate(row.tanggal_ijazah),
              nama_sekolah: row.nama_sekolah || '',
              kota: row.kota || '',
            }))
          : [],
        pendidikan_nonformal: Array.isArray(detail.pendidikan_nonformal)
          ? detail.pendidikan_nonformal.map((row: any) => ({
              nama_pelatihan: row.nama_pelatihan || '',
              tanggal_ijazah: toInputDate(row.tanggal_ijazah),
              penyelenggara: row.penyelenggara || '',
              kota: row.kota || '',
            }))
          : [],
        penghargaan: Array.isArray(detail.penghargaan)
          ? detail.penghargaan.map((row: any) => ({
              nama_penghargaan: row.nama_penghargaan || '',
              asal_penghargaan: row.asal_penghargaan || '',
              no_sk: row.no_sk || '',
              tanggal_sk: toInputDate(row.tanggal_sk),
            }))
          : [],
        skp: Array.isArray(detail.skp)
          ? detail.skp.map((row: any) => ({
              tahun: row.tahun ? String(row.tahun) : '',
              nilai_skp: row.nilai_skp ? String(row.nilai_skp) : '',
              nilai_perilaku: row.nilai_perilaku ? String(row.nilai_perilaku) : '',
              nilai_prestasi: row.nilai_prestasi ? String(row.nilai_prestasi) : '',
              keterangan: row.keterangan || '',
            }))
          : [],
      });
    } catch (err: any) {
      addToast('Gagal', err?.message || 'Gagal memuat data pegawai', 'error');
    }
  };

  const updateMasterField = (key: keyof PegawaiForm['master'], value: string) => {
    setFormData((prev) => ({
      ...prev,
      master: { ...prev.master, [key]: value },
    }));
  };

  const updatePasanganField = (key: keyof PegawaiForm['pasangan'], value: string) => {
    setFormData((prev) => ({
      ...prev,
      pasangan: { ...prev.pasangan, [key]: value },
    }));
  };

  const updateRowField = (
    section: keyof PegawaiForm,
    index: number,
    key: string,
    value: string
  ) => {
    setFormData((prev: any) => {
      const list = [...(prev[section] || [])];
      list[index] = { ...list[index], [key]: value };
      return { ...prev, [section]: list };
    });
  };

  const addRow = (section: keyof PegawaiForm, row: Record<string, any>) => {
    setFormData((prev: any) => ({
      ...prev,
      [section]: [...(prev[section] || []), row],
    }));
  };

  const removeRow = (section: keyof PegawaiForm, index: number) => {
    setFormData((prev: any) => {
      const list = [...(prev[section] || [])];
      list.splice(index, 1);
      return { ...prev, [section]: list };
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const requiredChecks = [
        { value: formData.master.nama, label: 'Nama Pegawai' },
        { value: formData.master.nama_ukpd, label: 'UKPD' },
        { value: formData.master.jenis_pegawai, label: 'Jenis Pegawai' },
        { value: formData.master.kondisi, label: 'Kondisi' },
      ];
      const missing = requiredChecks.filter((item) => !item.value);
      if (missing.length) {
        addToast(
          'Validasi',
          `Lengkapi field: ${missing.map((item) => item.label).join(', ')}`,
          'error'
        );
        setSaving(false);
        return;
      }

      const alamatInvalid = formData.alamat.some((row) => row && !row.tipe);
      if (alamatInvalid) {
        addToast('Validasi', 'Tipe alamat wajib dipilih.', 'error');
        setSaving(false);
        return;
      }

      if (modalMode === 'create') {
        await createPegawai(formData);
        addToast('Sukses', 'Pegawai berhasil ditambahkan.', 'success');
      } else if (activePegawaiId) {
        await updatePegawai(activePegawaiId, formData);
        addToast('Sukses', 'Pegawai berhasil diperbarui.', 'success');
      }
      setModalOpen(false);
      setReloadKey((prev) => prev + 1);
    } catch (err: any) {
      addToast('Gagal', err?.response?.data?.error || err?.message || 'Gagal menyimpan data.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const buildExportParams = (includeFilters: boolean) => {
    const params: NonNullable<Parameters<typeof getPegawai>[0]> = {
      limit: 5000,
      offset: 0,
      lite: 1,
    };
    if (unitSelectDisabled && user?.nama_ukpd) {
      params.unit = user.nama_ukpd;
    } else if (!includeFilters && role === 'wilayah' && user?.wilayah) {
      params.wilayah = user.wilayah;
    }
    if (includeFilters) {
      if (debouncedSearch) params.search = debouncedSearch;
      if (jabatanFilter) params.jabatan = jabatanFilter;
      if (activeStatuses.length) params.status = activeStatuses.join(',');
      if (unitSelectDisabled && user?.nama_ukpd) {
        params.unit = user.nama_ukpd;
      } else if (unitFilter) {
        params.unit = unitFilter;
      } else if (role === 'wilayah' && user?.wilayah) {
        params.wilayah = user.wilayah;
      }
    }
    return params;
  };

  const fetchAllPegawai = async (params: NonNullable<Parameters<typeof getPegawai>[0]>) => {
    const allRows: PegawaiRow[] = [];
    let offset = 0;
    let total = 0;
    const limit = 5000;
    while (true) {
      const response = await getPegawai({ ...params, limit, offset });
      const payload = response.data;
      const rows = Array.isArray(payload) ? payload : payload?.rows || [];
      const nextTotal = Number(payload?.total) || rows.length;
      if (!total) total = nextTotal;
      allRows.push(...rows);
      if (rows.length < limit || allRows.length >= nextTotal) break;
      offset += limit;
      if (offset > 200000) break;
    }
    return allRows;
  };

  const escapeCsv = (value: any) => {
    const raw = String(value ?? '');
    if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
      return `"${raw.replace(/\"/g, '""')}"`;
    }
    return raw;
  };

  const escapeHtml = (value: any) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const exportColumns = [
    { key: 'id_pegawai', label: 'ID Pegawai' },
    { key: 'nama_ukpd', label: 'Nama UKPD' },
    { key: 'nama', label: 'Nama' },
    { key: 'kondisi', label: 'Kondisi' },
    { key: 'nama_jabatan_orb', label: 'Nama Jabatan ORB' },
    { key: 'nama_jabatan_menpan', label: 'Nama Jabatan Menpan' },
    { key: 'struktur_atasan_langsung', label: 'Struktur Atasan Langsung' },
    { key: 'jenis_pegawai', label: 'Jenis Pegawai' },
    { key: 'status_rumpun', label: 'Status Rumpun' },
    { key: 'jenis_kontrak', label: 'Jenis Kontrak' },
    { key: 'nrk', label: 'NRK' },
    { key: 'nip', label: 'NIP' },
    { key: 'pangkat_golongan', label: 'Pangkat/Golongan' },
    { key: 'tmt_pangkat_terakhir', label: 'TMT Pangkat Terakhir' },
    { key: 'jenis_kelamin', label: 'Jenis Kelamin' },
    { key: 'tmt_kerja_ukpd', label: 'TMT Kerja UKPD' },
    { key: 'tempat_lahir', label: 'Tempat Lahir' },
    { key: 'tanggal_lahir', label: 'Tanggal Lahir' },
    { key: 'nik', label: 'NIK' },
    { key: 'agama', label: 'Agama' },
    { key: 'jenjang_pendidikan', label: 'Jenjang Pendidikan' },
    { key: 'program_studi', label: 'Program Studi' },
    { key: 'nama_universitas', label: 'Nama Universitas' },
    { key: 'no_hp_pegawai', label: 'No HP Pegawai' },
    { key: 'email', label: 'Email' },
    { key: 'no_bpjs', label: 'No BPJS' },
    { key: 'gelar_depan', label: 'Gelar Depan' },
    { key: 'gelar_belakang', label: 'Gelar Belakang' },
    { key: 'status_perkawinan', label: 'Status Perkawinan' },
    { key: 'created_at', label: 'Created At' },
  ];

  const downloadFile = (content: string, fileName: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = async () => {
    setExporting((prev) => ({ ...prev, csv: true }));
    try {
      const params = buildExportParams(true);
      const rows = await fetchAllPegawai({ ...params, full: 1, lite: 0 });
      if (!rows.length) {
        addToast('Info', 'Tidak ada data untuk diexport.', 'error');
        return;
      }
      const header = exportColumns.map((col) => escapeCsv(col.label)).join(',');
      const body = rows
        .map((row) =>
          exportColumns.map((col) => escapeCsv(row[col.key])).join(',')
        )
        .join('\n');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      downloadFile(`${header}\n${body}`, `pegawai-page-${stamp}.csv`, 'text/csv;charset=utf-8;');
      addToast('Sukses', 'Export CSV berhasil.', 'success');
    } catch (err: any) {
      addToast('Gagal', err?.message || 'Gagal export CSV.', 'error');
    } finally {
      setExporting((prev) => ({ ...prev, csv: false }));
    }
  };


  return (
    <>
      <Head>
        <title>Data Pegawai</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
              {isReady && menuItems.map((item) => {
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
                  {displayUkpd || 'Dinas Kesehatan'}
                </span>
              </div>
              <button type="button" className="danger-btn" onClick={handleLogout}>
                Keluar
              </button>
            </header>

            <main>
              <section className="page">
                <div className="panel">
                  <div className="filters">
                    <div className="full">
                      <label htmlFor="search">Kata Kunci (NIP/Nama)</label>
                      <input
                        id="search"
                        placeholder="Cari NIP atau Nama"
                        value={search}
                        onChange={(event) => {
                          setSearch(event.target.value);
                          setCurrentPage(1);
                        }}
                      />
                    </div>
                    <div>
                      <label htmlFor="unitFilter">Nama UKPD</label>
                      <select
                        id="unitFilter"
                        value={unitFilter}
                        disabled={unitSelectDisabled}
                        onChange={(event) => {
                          setUnitFilter(event.target.value);
                          setCurrentPage(1);
                        }}
                      >
                        <option value="">Pilih UKPD</option>
                        {unitOptions.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="jabatanFilter">Jabatan (ORB)</label>
                      <select
                        id="jabatanFilter"
                        value={jabatanFilter}
                        onChange={(event) => {
                          setJabatanFilter(event.target.value);
                          setCurrentPage(1);
                        }}
                      >
                        <option value="">Pilih Jabatan</option>
                        {jabatanOptions.map((jabatan) => (
                          <option key={jabatan} value={jabatan}>
                            {jabatan}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="filter-actions">
                      <button type="button" onClick={() => setCurrentPage(1)}>
                        Terapkan
                      </button>
                      <button type="button" className="secondary" onClick={handleReset}>
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="chips">
                    {statusOptions.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={`chip${activeStatuses.includes(status) ? ' active' : ''}`}
                        onClick={() => handleStatusToggle(status)}
                      >
                        {status}
                      </button>
                    ))}
                  </div>

                  <div id="status">Status: {statusText}</div>
                </div>

                <div className="panel">
                  <div className="table-tools">
                    <div className="page-size">
                      <label htmlFor="pageSize">Tampilkan</label>
                      <select
                        id="pageSize"
                        value={pageSize}
                        onChange={(event) => {
                          setPageSize(Number(event.target.value));
                          setCurrentPage(1);
                        }}
                      >
                        {[10, 25, 50, 100].map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                      <span>data</span>
                    </div>
                    <div className="table-actions">
                      <input
                        placeholder="Cari cepat..."
                        value={search}
                        onChange={(event) => {
                          setSearch(event.target.value);
                          setCurrentPage(1);
                        }}
                      />
                      <button type="button" className="secondary" onClick={exportCsv} disabled={exporting.csv}>
                        {exporting.csv ? 'Exporting...' : 'Export CSV'}
                      </button>
                      <button type="button" onClick={openCreateModal}>
                        + Tambah Pegawai
                      </button>
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>No</th>
                          <th>NIP</th>
                          <th>Nama</th>
                          <th>Jabatan ORB</th>
                          <th>Rumpun</th>
                          <th>Status Pegawai</th>
                          <th>UKPD</th>
                          <th>Kondisi</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedRows.map((row, idx) => (
                          <tr key={`${row.id_pegawai || row.nip}-${idx}`}>
                            <td>{(currentPage - 1) * pageSize + idx + 1}</td>
                            <td>{row.nip || '-'}</td>
                            <td>{row.nama || '-'}</td>
                            <td>{row.nama_jabatan_orb || '-'}</td>
                            <td>{row.status_rumpun || '-'}</td>
                            <td>{row.jenis_pegawai || '-'}</td>
                            <td>{row.nama_ukpd || '-'}</td>
                            <td>{row.kondisi || '-'}</td>
                            <td>
                              <div className="actions">
                                <button
                                  type="button"
                                  className="icon-btn icon-view"
                                  onClick={() => {
                                    const detailKey = row.nik || row.id_pegawai;
                                    detailKey
                                      ? router.push(`/pegawai/${encodeURIComponent(String(detailKey))}`)
                                      : addToast('Info', 'NIK/ID pegawai tidak tersedia.', 'error');
                                  }}
                                  aria-label="Lihat Profil"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M12 5c5 0 9.27 3.11 11 7-1.73 3.89-6 7-11 7S2.73 15.89 1 12c1.73-3.89 6-7 11-7Zm0 2c-3.76 0-7.09 2.2-8.74 5 1.65 2.8 4.98 5 8.74 5s7.09-2.2 8.74-5C19.09 9.2 15.76 7 12 7Zm0 2.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5Z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="icon-btn icon-edit"
                                  onClick={() => openEditModal(row.id_pegawai)}
                                  aria-label="Edit"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M3 17.25V21h3.75l11.06-11.06-3.75-3.75L3 17.25Zm2.06 2.69H5v-0.94l9.06-9.06.94.94-9.06 9.06Zm12.02-11.08-.94.94-3.75-3.75.94-.94a1 1 0 0 1 1.41 0l2.34 2.34a1 1 0 0 1 0 1.41Z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="icon-btn icon-delete"
                                  onClick={() =>
                                    addToast('Info', 'Fitur hapus belum tersedia.', 'error')
                                  }
                                  aria-label="Hapus"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M6 7h12l-1 13H7L6 7Zm3-3h6l1 1h4v2H4V5h4l1-1Zm1 5v9h2V9H10Zm4 0v9h2V9H14Z" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!pagedRows.length && (
                          <tr>
                            <td colSpan={9} className="empty-row">
                              Tidak ada data ditampilkan.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="pager">
                    <div>
                      Halaman {currentPage} / {totalPages} - Total{' '}
                      {totalRows.toLocaleString('id-ID')} baris
                    </div>
                    <div className="pager-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Sebelumnya
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                        }
                        disabled={currentPage === totalPages}
                      >
                        Berikutnya
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </main>

            <footer className="footer">
              (c) 2025 SI Data Informasi dan Layanan Kepegawaian.
            </footer>
          </div>
        </div>

        <div className={`modal-backdrop ${modalOpen ? 'show' : ''}`}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">
                <div className="modal-kicker">Form Pegawai</div>
                <h3>{modalMode === 'edit' ? 'Edit Pegawai' : 'Tambah Pegawai'}</h3>
                <p className="modal-sub">Lengkapi data master, kontak, dan riwayat pegawai.</p>
              </div>
              <button type="button" className="secondary" onClick={() => setModalOpen(false)}>
                Tutup
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-summary">
                <div className="summary-card">
                  <span className="summary-label">Alamat</span>
                  <span className="summary-value">{formData.alamat.length}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Anak</span>
                  <span className="summary-value">{formData.anak.length}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Pendidikan</span>
                  <span className="summary-value">{formData.pendidikan_formal.length + formData.pendidikan_nonformal.length}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Pangkat</span>
                  <span className="summary-value">{formData.pangkat.length}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Jabatan</span>
                  <span className="summary-value">{formData.jabatan_fungsional.length + formData.jabatan_struktural.length}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">SKP</span>
                  <span className="summary-value">{formData.skp.length}</span>
                </div>
              </div>
              <div className="form-section">
                <div className="section-title">Data Utama</div>
                <div className="section-grid">
                  <div>
                    <label>Nama Pegawai</label>
                    <input value={formData.master.nama} onChange={(e) => updateMasterField('nama', e.target.value)} />
                  </div>
                  <div>
                    <label>NIP</label>
                    <input value={formData.master.nip} onChange={(e) => updateMasterField('nip', e.target.value)} />
                  </div>
                  <div>
                    <label>NRK</label>
                    <input value={formData.master.nrk} onChange={(e) => updateMasterField('nrk', e.target.value)} />
                  </div>
                  <div>
                    <label>NIK</label>
                    <input value={formData.master.nik} onChange={(e) => updateMasterField('nik', e.target.value)} />
                  </div>
                  <div>
                    <label>Jenis Kelamin</label>
                    <select value={formData.master.jenis_kelamin} onChange={(e) => updateMasterField('jenis_kelamin', e.target.value)}>
                      {GENDER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Tempat Lahir</label>
                    <input value={formData.master.tempat_lahir} onChange={(e) => updateMasterField('tempat_lahir', e.target.value)} />
                  </div>
                  <div>
                    <label>Tanggal Lahir</label>
                    <input type="date" value={formData.master.tanggal_lahir} onChange={(e) => updateMasterField('tanggal_lahir', e.target.value)} />
                  </div>
                  <div>
                    <label>Agama</label>
                    <select value={formData.master.agama} onChange={(e) => updateMasterField('agama', e.target.value)}>
                      {AGAMA_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Status Perkawinan</label>
                    <select value={formData.master.status_perkawinan} onChange={(e) => updateMasterField('status_perkawinan', e.target.value)}>
                      {PERKAWINAN_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Gelar Depan</label>
                    <input value={formData.master.gelar_depan} onChange={(e) => updateMasterField('gelar_depan', e.target.value)} />
                  </div>
                  <div>
                    <label>Gelar Belakang</label>
                    <input value={formData.master.gelar_belakang} onChange={(e) => updateMasterField('gelar_belakang', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="section-title">Kepegawaian</div>
                <div className="section-grid">
                  <div>
                    <label>UKPD</label>
                    <input value={formData.master.nama_ukpd} onChange={(e) => updateMasterField('nama_ukpd', e.target.value)} />
                  </div>
                  <div>
                    <label>Jabatan ORB</label>
                    <input value={formData.master.nama_jabatan_orb} onChange={(e) => updateMasterField('nama_jabatan_orb', e.target.value)} />
                  </div>
                  <div>
                    <label>Jabatan Menpan</label>
                    <input value={formData.master.nama_jabatan_menpan} onChange={(e) => updateMasterField('nama_jabatan_menpan', e.target.value)} />
                  </div>
                  <div>
                    <label>Struktur Atasan Langsung</label>
                    <input value={formData.master.struktur_atasan_langsung} onChange={(e) => updateMasterField('struktur_atasan_langsung', e.target.value)} />
                  </div>
                  <div>
                    <label>Jenis Pegawai</label>
                    <select value={formData.master.jenis_pegawai} onChange={(e) => updateMasterField('jenis_pegawai', e.target.value)}>
                      {STATUS_PEGAWAI_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Status Rumpun</label>
                    <input value={formData.master.status_rumpun} onChange={(e) => updateMasterField('status_rumpun', e.target.value)} />
                  </div>
                  <div>
                    <label>Jenis Kontrak</label>
                    <select value={formData.master.jenis_kontrak} onChange={(e) => updateMasterField('jenis_kontrak', e.target.value)}>
                      {JENIS_KONTRAK_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Kondisi</label>
                    <select value={formData.master.kondisi} onChange={(e) => updateMasterField('kondisi', e.target.value)}>
                      {KONDISI_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Pangkat/Golongan</label>
                    <input value={formData.master.pangkat_golongan} onChange={(e) => updateMasterField('pangkat_golongan', e.target.value)} />
                  </div>
                  <div>
                    <label>TMT Pangkat Terakhir</label>
                    <input type="date" value={formData.master.tmt_pangkat_terakhir} onChange={(e) => updateMasterField('tmt_pangkat_terakhir', e.target.value)} />
                  </div>
                  <div>
                    <label>TMT Kerja UKPD</label>
                    <input type="date" value={formData.master.tmt_kerja_ukpd} onChange={(e) => updateMasterField('tmt_kerja_ukpd', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="section-title">Pendidikan</div>
                <div className="section-grid">
                  <div>
                    <label>Jenjang</label>
                    <input value={formData.master.jenjang_pendidikan} onChange={(e) => updateMasterField('jenjang_pendidikan', e.target.value)} />
                  </div>
                  <div>
                    <label>Program Studi</label>
                    <input value={formData.master.program_studi} onChange={(e) => updateMasterField('program_studi', e.target.value)} />
                  </div>
                  <div>
                    <label>Nama Universitas</label>
                    <input value={formData.master.nama_universitas} onChange={(e) => updateMasterField('nama_universitas', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="section-title">Kontak</div>
                <div className="section-grid">
                  <div>
                    <label>No HP</label>
                    <input value={formData.master.no_hp_pegawai} onChange={(e) => updateMasterField('no_hp_pegawai', e.target.value)} />
                  </div>
                  <div>
                    <label>Email</label>
                    <input value={formData.master.email} onChange={(e) => updateMasterField('email', e.target.value)} />
                  </div>
                  <div>
                    <label>No BPJS</label>
                    <input value={formData.master.no_bpjs} onChange={(e) => updateMasterField('no_bpjs', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="section-title">Alamat</div>
                {formData.alamat.map((row, idx) => (
                  <div className="section-grid" key={`alamat-${idx}`}>
                  <div>
                    <label>Tipe</label>
                    <select value={row.tipe} onChange={(e) => updateRowField('alamat', idx, 'tipe', e.target.value)}>
                      {ALAMAT_TIPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                    <div>
                      <label>Jalan</label>
                      <input value={row.jalan} onChange={(e) => updateRowField('alamat', idx, 'jalan', e.target.value)} />
                    </div>
                    <div>
                      <label>Kelurahan</label>
                      <input value={row.kelurahan} onChange={(e) => updateRowField('alamat', idx, 'kelurahan', e.target.value)} />
                    </div>
                    <div>
                      <label>Kecamatan</label>
                      <input value={row.kecamatan} onChange={(e) => updateRowField('alamat', idx, 'kecamatan', e.target.value)} />
                    </div>
                    <div>
                      <label>Kota/Kabupaten</label>
                      <input value={row.kota_kabupaten} onChange={(e) => updateRowField('alamat', idx, 'kota_kabupaten', e.target.value)} />
                    </div>
                    <div>
                      <label>Provinsi</label>
                      <input value={row.provinsi} onChange={(e) => updateRowField('alamat', idx, 'provinsi', e.target.value)} />
                    </div>
                    <div>
                      <label>Kode Provinsi</label>
                      <input value={row.kode_provinsi} onChange={(e) => updateRowField('alamat', idx, 'kode_provinsi', e.target.value)} />
                    </div>
                    <div>
                      <label>Kode Kota</label>
                      <input value={row.kode_kota_kab} onChange={(e) => updateRowField('alamat', idx, 'kode_kota_kab', e.target.value)} />
                    </div>
                    <div>
                      <label>Kode Kecamatan</label>
                      <input value={row.kode_kecamatan} onChange={(e) => updateRowField('alamat', idx, 'kode_kecamatan', e.target.value)} />
                    </div>
                    <div>
                      <label>Kode Kelurahan</label>
                      <input value={row.kode_kelurahan} onChange={(e) => updateRowField('alamat', idx, 'kode_kelurahan', e.target.value)} />
                    </div>
                    <div>
                      <label>&nbsp;</label>
                      <button type="button" className="secondary" onClick={() => removeRow('alamat', idx)}>
                        Hapus Alamat
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    addRow('alamat', {
                      tipe: '',
                      jalan: '',
                      kelurahan: '',
                      kecamatan: '',
                      kota_kabupaten: '',
                      provinsi: '',
                      kode_provinsi: '',
                      kode_kota_kab: '',
                      kode_kecamatan: '',
                      kode_kelurahan: '',
                    })
                  }
                >
                  + Tambah Alamat
                </button>
              </div>

              <div className="form-section">
                <div className="section-title">Pasangan</div>
                <div className="section-grid">
                  <div>
                    <label>Status Punya</label>
                    <select value={formData.pasangan.status_punya} onChange={(e) => updatePasanganField('status_punya', e.target.value)}>
                      {PASANGAN_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Nama</label>
                    <input value={formData.pasangan.nama} onChange={(e) => updatePasanganField('nama', e.target.value)} />
                  </div>
                  <div>
                    <label>No Tlp</label>
                    <input value={formData.pasangan.no_tlp} onChange={(e) => updatePasanganField('no_tlp', e.target.value)} />
                  </div>
                  <div>
                    <label>Email</label>
                    <input value={formData.pasangan.email} onChange={(e) => updatePasanganField('email', e.target.value)} />
                  </div>
                  <div>
                    <label>Pekerjaan</label>
                    <input value={formData.pasangan.pekerjaan} onChange={(e) => updatePasanganField('pekerjaan', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="section-title">Anak</div>
                {formData.anak.map((row, idx) => (
                  <div className="section-grid" key={`anak-${idx}`}>
                    <div>
                      <label>Urutan</label>
                      <input value={row.urutan} onChange={(e) => updateRowField('anak', idx, 'urutan', e.target.value)} />
                    </div>
                    <div>
                      <label>Nama</label>
                      <input value={row.nama} onChange={(e) => updateRowField('anak', idx, 'nama', e.target.value)} />
                    </div>
                  <div>
                    <label>Jenis Kelamin</label>
                    <select value={row.jenis_kelamin} onChange={(e) => updateRowField('anak', idx, 'jenis_kelamin', e.target.value)}>
                      {GENDER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                    <div>
                      <label>Tempat Lahir</label>
                      <input value={row.tempat_lahir} onChange={(e) => updateRowField('anak', idx, 'tempat_lahir', e.target.value)} />
                    </div>
                    <div>
                      <label>Tanggal Lahir</label>
                      <input type="date" value={row.tanggal_lahir} onChange={(e) => updateRowField('anak', idx, 'tanggal_lahir', e.target.value)} />
                    </div>
                    <div>
                      <label>Pekerjaan</label>
                      <input value={row.pekerjaan} onChange={(e) => updateRowField('anak', idx, 'pekerjaan', e.target.value)} />
                    </div>
                    <div>
                      <label>&nbsp;</label>
                      <button type="button" className="secondary" onClick={() => removeRow('anak', idx)}>
                        Hapus Anak
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    addRow('anak', {
                      urutan: '',
                      nama: '',
                      jenis_kelamin: '',
                      tempat_lahir: '',
                      tanggal_lahir: '',
                      pekerjaan: '',
                    })
                  }
                >
                  + Tambah Anak
                </button>
              </div>

              <div className="form-section">
                <div className="section-title">Riwayat Pangkat</div>
                {formData.pangkat.map((row, idx) => (
                  <div className="section-grid" key={`pangkat-${idx}`}>
                    <div>
                      <label>TMT</label>
                      <input type="date" value={row.tmt} onChange={(e) => updateRowField('pangkat', idx, 'tmt', e.target.value)} />
                    </div>
                    <div>
                      <label>Pangkat</label>
                      <input value={row.pangkat} onChange={(e) => updateRowField('pangkat', idx, 'pangkat', e.target.value)} />
                    </div>
                    <div>
                      <label>Lokasi</label>
                      <input value={row.lokasi} onChange={(e) => updateRowField('pangkat', idx, 'lokasi', e.target.value)} />
                    </div>
                    <div>
                      <label>No SK</label>
                      <input value={row.no_sk} onChange={(e) => updateRowField('pangkat', idx, 'no_sk', e.target.value)} />
                    </div>
                    <div>
                      <label>Tanggal SK</label>
                      <input type="date" value={row.tanggal_sk} onChange={(e) => updateRowField('pangkat', idx, 'tanggal_sk', e.target.value)} />
                    </div>
                    <div>
                      <label>&nbsp;</label>
                      <button type="button" className="secondary" onClick={() => removeRow('pangkat', idx)}>
                        Hapus Pangkat
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    addRow('pangkat', {
                      tmt: '',
                      pangkat: '',
                      lokasi: '',
                      no_sk: '',
                      tanggal_sk: '',
                    })
                  }
                >
                  + Tambah Pangkat
                </button>
              </div>

              <div className="form-section">
                <div className="section-title">Jabatan Fungsional</div>
                {formData.jabatan_fungsional.map((row, idx) => (
                  <div className="section-grid" key={`jf-${idx}`}>
                    <div>
                      <label>TMT</label>
                      <input type="date" value={row.tmt} onChange={(e) => updateRowField('jabatan_fungsional', idx, 'tmt', e.target.value)} />
                    </div>
                    <div>
                      <label>Jabatan</label>
                      <input value={row.jabatan} onChange={(e) => updateRowField('jabatan_fungsional', idx, 'jabatan', e.target.value)} />
                    </div>
                    <div>
                      <label>Pangkat</label>
                      <input value={row.pangkat} onChange={(e) => updateRowField('jabatan_fungsional', idx, 'pangkat', e.target.value)} />
                    </div>
                    <div>
                      <label>No SK</label>
                      <input value={row.no_sk} onChange={(e) => updateRowField('jabatan_fungsional', idx, 'no_sk', e.target.value)} />
                    </div>
                    <div>
                      <label>Tanggal SK</label>
                      <input type="date" value={row.tanggal_sk} onChange={(e) => updateRowField('jabatan_fungsional', idx, 'tanggal_sk', e.target.value)} />
                    </div>
                    <div>
                      <label>&nbsp;</label>
                      <button type="button" className="secondary" onClick={() => removeRow('jabatan_fungsional', idx)}>
                        Hapus Jabatan Fungsional
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    addRow('jabatan_fungsional', {
                      tmt: '',
                      jabatan: '',
                      pangkat: '',
                      no_sk: '',
                      tanggal_sk: '',
                    })
                  }
                >
                  + Tambah Jabatan Fungsional
                </button>
              </div>

              <div className="form-section">
                <div className="section-title">Jabatan Struktural</div>
                {formData.jabatan_struktural.map((row, idx) => (
                  <div className="section-grid" key={`js-${idx}`}>
                    <div>
                      <label>TMT</label>
                      <input type="date" value={row.tmt} onChange={(e) => updateRowField('jabatan_struktural', idx, 'tmt', e.target.value)} />
                    </div>
                    <div>
                      <label>Lokasi</label>
                      <input value={row.lokasi} onChange={(e) => updateRowField('jabatan_struktural', idx, 'lokasi', e.target.value)} />
                    </div>
                    <div>
                      <label>Jabatan</label>
                      <input value={row.jabatan} onChange={(e) => updateRowField('jabatan_struktural', idx, 'jabatan', e.target.value)} />
                    </div>
                    <div>
                      <label>Pangkat</label>
                      <input value={row.pangkat} onChange={(e) => updateRowField('jabatan_struktural', idx, 'pangkat', e.target.value)} />
                    </div>
                    <div>
                      <label>Eselon</label>
                      <input value={row.eselon} onChange={(e) => updateRowField('jabatan_struktural', idx, 'eselon', e.target.value)} />
                    </div>
                    <div>
                      <label>No SK</label>
                      <input value={row.no_sk} onChange={(e) => updateRowField('jabatan_struktural', idx, 'no_sk', e.target.value)} />
                    </div>
                    <div>
                      <label>Tanggal SK</label>
                      <input type="date" value={row.tanggal_sk} onChange={(e) => updateRowField('jabatan_struktural', idx, 'tanggal_sk', e.target.value)} />
                    </div>
                    <div>
                      <label>&nbsp;</label>
                      <button type="button" className="secondary" onClick={() => removeRow('jabatan_struktural', idx)}>
                        Hapus Jabatan Struktural
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    addRow('jabatan_struktural', {
                      tmt: '',
                      lokasi: '',
                      jabatan: '',
                      pangkat: '',
                      eselon: '',
                      no_sk: '',
                      tanggal_sk: '',
                    })
                  }
                >
                  + Tambah Jabatan Struktural
                </button>
              </div>

              <div className="form-section">
                <div className="section-title">Gaji Pokok</div>
                {formData.gaji_pokok.map((row, idx) => (
                  <div className="section-grid" key={`gaji-${idx}`}>
                    <div>
                      <label>TMT</label>
                      <input type="date" value={row.tmt} onChange={(e) => updateRowField('gaji_pokok', idx, 'tmt', e.target.value)} />
                    </div>
                    <div>
                      <label>Pangkat</label>
                      <input value={row.pangkat} onChange={(e) => updateRowField('gaji_pokok', idx, 'pangkat', e.target.value)} />
                    </div>
                    <div>
                      <label>Gaji</label>
                      <input value={row.gaji} onChange={(e) => updateRowField('gaji_pokok', idx, 'gaji', e.target.value)} />
                    </div>
                    <div>
                      <label>No SK</label>
                      <input value={row.no_sk} onChange={(e) => updateRowField('gaji_pokok', idx, 'no_sk', e.target.value)} />
                    </div>
                    <div>
                      <label>Tanggal SK</label>
                      <input type="date" value={row.tanggal_sk} onChange={(e) => updateRowField('gaji_pokok', idx, 'tanggal_sk', e.target.value)} />
                    </div>
                    <div>
                      <label>&nbsp;</label>
                      <button type="button" className="secondary" onClick={() => removeRow('gaji_pokok', idx)}>
                        Hapus Gaji
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    addRow('gaji_pokok', {
                      tmt: '',
                      pangkat: '',
                      gaji: '',
                      no_sk: '',
                      tanggal_sk: '',
                    })
                  }
                >
                  + Tambah Gaji
                </button>
              </div>

              <div className="form-section">
                <div className="section-title">Hukuman Disiplin</div>
                {formData.hukuman_disiplin.map((row, idx) => (
                  <div className="section-grid" key={`hukuman-${idx}`}>
                    <div>
                      <label>Mulai</label>
                      <input type="date" value={row.tanggal_mulai} onChange={(e) => updateRowField('hukuman_disiplin', idx, 'tanggal_mulai', e.target.value)} />
                    </div>
                    <div>
                      <label>Selesai</label>
                      <input type="date" value={row.tanggal_akhir} onChange={(e) => updateRowField('hukuman_disiplin', idx, 'tanggal_akhir', e.target.value)} />
                    </div>
                    <div>
                      <label>Jenis Hukuman</label>
                      <input value={row.jenis_hukuman} onChange={(e) => updateRowField('hukuman_disiplin', idx, 'jenis_hukuman', e.target.value)} />
                    </div>
                    <div>
                      <label>No SK</label>
                      <input value={row.no_sk} onChange={(e) => updateRowField('hukuman_disiplin', idx, 'no_sk', e.target.value)} />
                    </div>
                    <div>
                      <label>Tanggal SK</label>
                      <input type="date" value={row.tanggal_sk} onChange={(e) => updateRowField('hukuman_disiplin', idx, 'tanggal_sk', e.target.value)} />
                    </div>
                    <div>
                      <label>Keterangan</label>
                      <input value={row.keterangan} onChange={(e) => updateRowField('hukuman_disiplin', idx, 'keterangan', e.target.value)} />
                    </div>
                    <div>
                      <label>&nbsp;</label>
                      <button type="button" className="secondary" onClick={() => removeRow('hukuman_disiplin', idx)}>
                        Hapus Hukuman
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    addRow('hukuman_disiplin', {
                      tanggal_mulai: '',
                      tanggal_akhir: '',
                      jenis_hukuman: '',
                      no_sk: '',
                      tanggal_sk: '',
                      keterangan: '',
                    })
                  }
                >
                  + Tambah Hukuman
                </button>
              </div>

              <div className="form-section">
                <div className="section-title">Pendidikan Formal</div>
                {formData.pendidikan_formal.map((row, idx) => (
                  <div className="section-grid" key={`pf-${idx}`}>
                    <div>
                      <label>Tingkat</label>
                      <input value={row.tingkat} onChange={(e) => updateRowField('pendidikan_formal', idx, 'tingkat', e.target.value)} />
                    </div>
                    <div>
                      <label>Jurusan</label>
                      <input value={row.jurusan} onChange={(e) => updateRowField('pendidikan_formal', idx, 'jurusan', e.target.value)} />
                    </div>
                    <div>
                      <label>Tanggal Ijazah</label>
                      <input type="date" value={row.tanggal_ijazah} onChange={(e) => updateRowField('pendidikan_formal', idx, 'tanggal_ijazah', e.target.value)} />
                    </div>
                    <div>
                      <label>Nama Sekolah</label>
                      <input value={row.nama_sekolah} onChange={(e) => updateRowField('pendidikan_formal', idx, 'nama_sekolah', e.target.value)} />
                    </div>
                    <div>
                      <label>Kota</label>
                      <input value={row.kota} onChange={(e) => updateRowField('pendidikan_formal', idx, 'kota', e.target.value)} />
                    </div>
                    <div>
                      <label>&nbsp;</label>
                      <button type="button" className="secondary" onClick={() => removeRow('pendidikan_formal', idx)}>
                        Hapus Pendidikan Formal
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    addRow('pendidikan_formal', {
                      tingkat: '',
                      jurusan: '',
                      tanggal_ijazah: '',
                      nama_sekolah: '',
                      kota: '',
                    })
                  }
                >
                  + Tambah Pendidikan Formal
                </button>
              </div>

              <div className="form-section">
                <div className="section-title">Pendidikan Nonformal</div>
                {formData.pendidikan_nonformal.map((row, idx) => (
                  <div className="section-grid" key={`pnf-${idx}`}>
                    <div>
                      <label>Pelatihan</label>
                      <input value={row.nama_pelatihan} onChange={(e) => updateRowField('pendidikan_nonformal', idx, 'nama_pelatihan', e.target.value)} />
                    </div>
                    <div>
                      <label>Tanggal Ijazah</label>
                      <input type="date" value={row.tanggal_ijazah} onChange={(e) => updateRowField('pendidikan_nonformal', idx, 'tanggal_ijazah', e.target.value)} />
                    </div>
                    <div>
                      <label>Penyelenggara</label>
                      <input value={row.penyelenggara} onChange={(e) => updateRowField('pendidikan_nonformal', idx, 'penyelenggara', e.target.value)} />
                    </div>
                    <div>
                      <label>Kota</label>
                      <input value={row.kota} onChange={(e) => updateRowField('pendidikan_nonformal', idx, 'kota', e.target.value)} />
                    </div>
                    <div>
                      <label>&nbsp;</label>
                      <button type="button" className="secondary" onClick={() => removeRow('pendidikan_nonformal', idx)}>
                        Hapus Pendidikan Nonformal
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    addRow('pendidikan_nonformal', {
                      nama_pelatihan: '',
                      tanggal_ijazah: '',
                      penyelenggara: '',
                      kota: '',
                    })
                  }
                >
                  + Tambah Pendidikan Nonformal
                </button>
              </div>

              <div className="form-section">
                <div className="section-title">Penghargaan</div>
                {formData.penghargaan.map((row, idx) => (
                  <div className="section-grid" key={`penghargaan-${idx}`}>
                    <div>
                      <label>Nama Penghargaan</label>
                      <input value={row.nama_penghargaan} onChange={(e) => updateRowField('penghargaan', idx, 'nama_penghargaan', e.target.value)} />
                    </div>
                    <div>
                      <label>Asal Penghargaan</label>
                      <input value={row.asal_penghargaan} onChange={(e) => updateRowField('penghargaan', idx, 'asal_penghargaan', e.target.value)} />
                    </div>
                    <div>
                      <label>No SK</label>
                      <input value={row.no_sk} onChange={(e) => updateRowField('penghargaan', idx, 'no_sk', e.target.value)} />
                    </div>
                    <div>
                      <label>Tanggal SK</label>
                      <input type="date" value={row.tanggal_sk} onChange={(e) => updateRowField('penghargaan', idx, 'tanggal_sk', e.target.value)} />
                    </div>
                    <div>
                      <label>&nbsp;</label>
                      <button type="button" className="secondary" onClick={() => removeRow('penghargaan', idx)}>
                        Hapus Penghargaan
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    addRow('penghargaan', {
                      nama_penghargaan: '',
                      asal_penghargaan: '',
                      no_sk: '',
                      tanggal_sk: '',
                    })
                  }
                >
                  + Tambah Penghargaan
                </button>
              </div>

              <div className="form-section">
                <div className="section-title">SKP</div>
                {formData.skp.map((row, idx) => (
                  <div className="section-grid" key={`skp-${idx}`}>
                    <div>
                      <label>Tahun</label>
                      <input value={row.tahun} onChange={(e) => updateRowField('skp', idx, 'tahun', e.target.value)} />
                    </div>
                    <div>
                      <label>Nilai SKP</label>
                      <input value={row.nilai_skp} onChange={(e) => updateRowField('skp', idx, 'nilai_skp', e.target.value)} />
                    </div>
                    <div>
                      <label>Nilai Perilaku</label>
                      <input value={row.nilai_perilaku} onChange={(e) => updateRowField('skp', idx, 'nilai_perilaku', e.target.value)} />
                    </div>
                    <div>
                      <label>Nilai Prestasi</label>
                      <input value={row.nilai_prestasi} onChange={(e) => updateRowField('skp', idx, 'nilai_prestasi', e.target.value)} />
                    </div>
                    <div>
                      <label>Keterangan</label>
                      <input value={row.keterangan} onChange={(e) => updateRowField('skp', idx, 'keterangan', e.target.value)} />
                    </div>
                    <div>
                      <label>&nbsp;</label>
                      <button type="button" className="secondary" onClick={() => removeRow('skp', idx)}>
                        Hapus SKP
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    addRow('skp', {
                      tahun: '',
                      nilai_skp: '',
                      nilai_perilaku: '',
                      nilai_prestasi: '',
                      keterangan: '',
                    })
                  }
                >
                  + Tambah SKP
                </button>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="toast-container" aria-live="polite" aria-atomic="true">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.type}`}>
              <div className="toast-title">{toast.title}</div>
              <div className="toast-msg">{toast.message}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
