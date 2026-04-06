'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  DoughnutController,
  BarController,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { getDashboardStats, logout } from '@/lib/api';
import { getStoredUser, normalizeRole, roleLabel } from '@/lib/auth';
import { navItems } from '@/lib/nav';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  DoughnutController,
  BarController,
  ChartDataLabels
);

type ChartMode = 'status' | 'gender' | 'marital';

type StatRow = Record<string, any>;

interface TableRow {
  wilayah: string;
  unit: string;
  PNS: number;
  CPNS: number;
  PPPK: number;
  'NON PNS': number;
  PJLP: number;
  total: number;
  isGroup?: boolean;
  no?: number;
}

interface DashboardData {
  statusCounts: Record<string, number>;
  genderCounts: Record<string, number>;
  maritalCounts: Record<string, number>;
  unitLabelsStatus: string[];
  unitDatasetsStatus: any[];
  unitDatasetsGender: any[];
  unitDatasetsMarital: any[];
  rumpunLabelsStatus: string[];
  rumpunDatasetsStatus: any[];
  rumpunDatasetsGender: any[];
  rumpunDatasetsMarital: any[];
  pendidikanLabelsStatus: string[];
  pendidikanDatasetsStatus: any[];
  pendidikanDatasetsGender: any[];
  pendidikanDatasetsMarital: any[];
  tableRows: TableRow[];
}

const statusOrder = ['PNS', 'CPNS', 'PPPK', 'NON PNS', 'PJLP'];
const statusLabels: Record<string, string> = {
  PNS: 'PNS',
  CPNS: 'CPNS',
  PPPK: 'PPPK',
  'NON PNS': 'PROFESIONAL',
  PJLP: 'PJLP',
};
const statusColors: Record<string, string> = {
  PNS: '#0EA5E9',
  CPNS: '#06B6D4',
  PPPK: '#22C55E',
  'NON PNS': '#14B8A6',
  PJLP: '#8B5CF6',
};

const genderOrder = ['LAKI', 'PEREMPUAN'];
const genderLabels: Record<string, string> = { LAKI: 'Laki-laki', PEREMPUAN: 'Perempuan' };
const genderColors: Record<string, string> = { LAKI: '#0EA5E9', PEREMPUAN: '#F97316' };

const maritalOrder = ['BELUM_MENIKAH', 'MENIKAH', 'CERAI_HIDUP', 'CERAI_MATI'];
const maritalLabels: Record<string, string> = {
  BELUM_MENIKAH: 'Belum Menikah',
  MENIKAH: 'Menikah',
  CERAI_HIDUP: 'Cerai Hidup',
  CERAI_MATI: 'Cerai Mati',
};
const maritalColors: Record<string, string> = {
  BELUM_MENIKAH: '#0EA5E9',
  MENIKAH: '#22C55E',
  CERAI_HIDUP: '#F97316',
  CERAI_MATI: '#EF4444',
};

const statusGradients: Record<string, string> = {
  PNS: 'linear-gradient(135deg, #0ea5e9, #0f9d94)',
  CPNS: 'linear-gradient(135deg, #06b6d4, #0ea5e9)',
  PPPK: 'linear-gradient(135deg, #22c55e, #16a34a)',
  'NON PNS': 'linear-gradient(135deg, #0ea5e9, #14b8a6)',
  PJLP: 'linear-gradient(135deg, #7c3aed, #a855f7)',
};

const normalizeStatus = (raw: string | undefined): string => {
  const t = (raw || '').toUpperCase().trim();
  if (t === 'PNS') return 'PNS';
  if (t === 'CPNS') return 'CPNS';
  if (t === 'PPPK' || t.includes('P3K')) return 'PPPK';
  if (t === 'PJLP') return 'PJLP';
  if (['NON ASN', 'NON PNS', 'PROFESIONAL', 'PROFESIONAL (NON PNS)', 'PROFESIONAL/NON PNS', 'TENAGA PROFESIONAL'].includes(t)) return 'NON PNS';
  return 'LAINNYA';
};

const normalizeGender = (raw: string | undefined): string => {
  const t = (raw || '').toLowerCase().trim();
  if (!t) return '';
  if (['l', 'laki', 'laki-laki', 'laki laki', 'pria', 'cowok', 'cwo', 'male', 'm', 'lk'].includes(t) || t.includes('laki')) return 'LAKI';
  if (['p', 'perempuan', 'wanita', 'cewek', 'cwe', 'female', 'f', 'pr'].includes(t) || t.includes('perempuan')) return 'PEREMPUAN';
  return '';
};

const normalizeMarital = (raw: string | undefined): string => {
  const t = (raw || '').toLowerCase().trim();
  if (!t) return '';
  if (t.includes('belum') || t.includes('single') || t.includes('tidak menikah')) return 'BELUM_MENIKAH';
  if (t.includes('cerai') && t.includes('mati')) return 'CERAI_MATI';
  if (t.includes('cerai') && t.includes('hidup')) return 'CERAI_HIDUP';
  if (t.includes('janda') || t.includes('duda')) return 'CERAI_MATI';
  if (t.includes('menikah') || t.includes('kawin')) return 'MENIKAH';
  return '';
};

const emptyStatusCounts = () => statusOrder.reduce((acc, key) => ({ ...acc, [key]: 0 }), {} as Record<string, number>);
const emptyGenderCounts = () => ({ LAKI: 0, PEREMPUAN: 0 });
const emptyMaritalCounts = () => maritalOrder.reduce((acc, key) => ({ ...acc, [key]: 0 }), {} as Record<string, number>);

const cleanLabel = (value: unknown) => {
  const text = String(value ?? '').trim();
  const lower = text.toLowerCase();
  if (!text || text === '0' || lower === 'null' || lower === 'undefined') {
    return 'Tidak Tercatat';
  }
  return text;
};

const collectLabels = (...maps: Array<Record<string, Record<string, number>>>) => {
  const all = new Set<string>();
  maps.forEach((map) => Object.keys(map).forEach((key) => all.add(key)));
  return Array.from(all).sort();
};

const prepareStats = (payload: Record<string, any>): DashboardData => {
  const statusCounts = emptyStatusCounts();
  const genderCounts = emptyGenderCounts();
  const maritalCounts = emptyMaritalCounts();
  const unitStatusMap: Record<string, Record<string, number>> = {};
  const unitGenderMap: Record<string, Record<string, number>> = {};
  const unitMaritalMap: Record<string, Record<string, number>> = {};
  const rumpunStatusMap: Record<string, Record<string, number>> = {};
  const rumpunGenderMap: Record<string, Record<string, number>> = {};
  const rumpunMaritalMap: Record<string, Record<string, number>> = {};
  const pendidikanStatusMap: Record<string, Record<string, number>> = {};
  const pendidikanGenderMap: Record<string, Record<string, number>> = {};
  const pendidikanMaritalMap: Record<string, Record<string, number>> = {};
  const wilayahMap: Record<string, Record<string, Record<string, number>>> = {};

  const makeDatasets = (
    map: Record<string, Record<string, number>>,
    labels: string[],
    order: string[],
    labelMap: Record<string, string>,
    colorMap: Record<string, string>
  ) => {
    return order.map((key) => ({
      label: labelMap[key] || key,
      data: labels.map((label) => map[label]?.[key] || 0),
      backgroundColor: colorMap[key] || '#94a3b8',
      borderRadius: 6,
    }));
  };

  const statusRows: StatRow[] = Array.isArray(payload?.statusCounts) ? payload.statusCounts : [];
  statusRows.forEach((row) => {
    const status = normalizeStatus(row.status);
    if (status === 'LAINNYA') return;
    const count = Number(row.count) || 0;
    statusCounts[status] = (statusCounts[status] || 0) + count;
  });

  const unitStatusRows: StatRow[] = Array.isArray(payload?.unitStatus) ? payload.unitStatus : [];
  unitStatusRows.forEach((row) => {
    const status = normalizeStatus(row.status);
    if (status === 'LAINNYA') return;
    const unit = cleanLabel(row.unit);
    const wilayah = cleanLabel(row.wilayah);
    const count = Number(row.count) || 0;
    unitStatusMap[unit] = unitStatusMap[unit] || emptyStatusCounts();
    unitStatusMap[unit][status] = (unitStatusMap[unit][status] || 0) + count;
    wilayahMap[wilayah] = wilayahMap[wilayah] || {};
    wilayahMap[wilayah][unit] = wilayahMap[wilayah][unit] || emptyStatusCounts();
    wilayahMap[wilayah][unit][status] = (wilayahMap[wilayah][unit][status] || 0) + count;
  });

  const rumpunStatusRows: StatRow[] = Array.isArray(payload?.rumpunStatus) ? payload.rumpunStatus : [];
  rumpunStatusRows.forEach((row) => {
    const status = normalizeStatus(row.status);
    if (status === 'LAINNYA') return;
    const rumpun = cleanLabel(row.rumpun);
    const count = Number(row.count) || 0;
    rumpunStatusMap[rumpun] = rumpunStatusMap[rumpun] || emptyStatusCounts();
    rumpunStatusMap[rumpun][status] = (rumpunStatusMap[rumpun][status] || 0) + count;
  });

  const pendidikanStatusRows: StatRow[] = Array.isArray(payload?.pendidikanStatus) ? payload.pendidikanStatus : [];
  pendidikanStatusRows.forEach((row) => {
    const status = normalizeStatus(row.status);
    if (status === 'LAINNYA') return;
    const pendidikan = cleanLabel(row.pendidikan);
    const count = Number(row.count) || 0;
    pendidikanStatusMap[pendidikan] = pendidikanStatusMap[pendidikan] || emptyStatusCounts();
    pendidikanStatusMap[pendidikan][status] = (pendidikanStatusMap[pendidikan][status] || 0) + count;
  });

  const genderRows: StatRow[] = Array.isArray(payload?.genderCounts) ? payload.genderCounts : [];
  genderRows.forEach((row) => {
    const gender = normalizeGender(row.gender);
    if (!gender) return;
    genderCounts[gender] = (genderCounts[gender] || 0) + (Number(row.count) || 0);
  });

  const maritalRows: StatRow[] = Array.isArray(payload?.maritalCounts) ? payload.maritalCounts : [];
  maritalRows.forEach((row) => {
    const marital = normalizeMarital(row.marital);
    if (!marital) return;
    maritalCounts[marital] = (maritalCounts[marital] || 0) + (Number(row.count) || 0);
  });

  const unitGenderRows: StatRow[] = Array.isArray(payload?.unitGender) ? payload.unitGender : [];
  unitGenderRows.forEach((row) => {
    const gender = normalizeGender(row.gender);
    if (!gender) return;
    const unit = cleanLabel(row.unit);
    const count = Number(row.count) || 0;
    unitGenderMap[unit] = unitGenderMap[unit] || emptyGenderCounts();
    unitGenderMap[unit][gender] = (unitGenderMap[unit][gender] || 0) + count;
  });

  const unitMaritalRows: StatRow[] = Array.isArray(payload?.unitMarital) ? payload.unitMarital : [];
  unitMaritalRows.forEach((row) => {
    const marital = normalizeMarital(row.marital);
    if (!marital) return;
    const unit = cleanLabel(row.unit);
    const count = Number(row.count) || 0;
    unitMaritalMap[unit] = unitMaritalMap[unit] || emptyMaritalCounts();
    unitMaritalMap[unit][marital] = (unitMaritalMap[unit][marital] || 0) + count;
  });

  const rumpunGenderRows: StatRow[] = Array.isArray(payload?.rumpunGender) ? payload.rumpunGender : [];
  rumpunGenderRows.forEach((row) => {
    const gender = normalizeGender(row.gender);
    if (!gender) return;
    const rumpun = cleanLabel(row.rumpun);
    const count = Number(row.count) || 0;
    rumpunGenderMap[rumpun] = rumpunGenderMap[rumpun] || emptyGenderCounts();
    rumpunGenderMap[rumpun][gender] = (rumpunGenderMap[rumpun][gender] || 0) + count;
  });

  const rumpunMaritalRows: StatRow[] = Array.isArray(payload?.rumpunMarital) ? payload.rumpunMarital : [];
  rumpunMaritalRows.forEach((row) => {
    const marital = normalizeMarital(row.marital);
    if (!marital) return;
    const rumpun = cleanLabel(row.rumpun);
    const count = Number(row.count) || 0;
    rumpunMaritalMap[rumpun] = rumpunMaritalMap[rumpun] || emptyMaritalCounts();
    rumpunMaritalMap[rumpun][marital] = (rumpunMaritalMap[rumpun][marital] || 0) + count;
  });

  const pendidikanGenderRows: StatRow[] = Array.isArray(payload?.pendidikanGender) ? payload.pendidikanGender : [];
  pendidikanGenderRows.forEach((row) => {
    const gender = normalizeGender(row.gender);
    if (!gender) return;
    const pendidikan = cleanLabel(row.pendidikan);
    const count = Number(row.count) || 0;
    pendidikanGenderMap[pendidikan] = pendidikanGenderMap[pendidikan] || emptyGenderCounts();
    pendidikanGenderMap[pendidikan][gender] = (pendidikanGenderMap[pendidikan][gender] || 0) + count;
  });

  const pendidikanMaritalRows: StatRow[] = Array.isArray(payload?.pendidikanMarital) ? payload.pendidikanMarital : [];
  pendidikanMaritalRows.forEach((row) => {
    const marital = normalizeMarital(row.marital);
    if (!marital) return;
    const pendidikan = cleanLabel(row.pendidikan);
    const count = Number(row.count) || 0;
    pendidikanMaritalMap[pendidikan] = pendidikanMaritalMap[pendidikan] || emptyMaritalCounts();
    pendidikanMaritalMap[pendidikan][marital] = (pendidikanMaritalMap[pendidikan][marital] || 0) + count;
  });

  const unitLabelsStatus = collectLabels(unitStatusMap, unitGenderMap, unitMaritalMap);
  const rumpunLabelsStatus = collectLabels(rumpunStatusMap, rumpunGenderMap, rumpunMaritalMap).sort((a, b) => {
    const totalB = Object.values(rumpunStatusMap[b] || {}).reduce((sum, value) => sum + value, 0);
    const totalA = Object.values(rumpunStatusMap[a] || {}).reduce((sum, value) => sum + value, 0);
    return totalB - totalA;
  });
  const pendidikanLabelsStatus = collectLabels(pendidikanStatusMap, pendidikanGenderMap, pendidikanMaritalMap).sort((a, b) => {
    const totalB = Object.values(pendidikanStatusMap[b] || {}).reduce((sum, value) => sum + value, 0);
    const totalA = Object.values(pendidikanStatusMap[a] || {}).reduce((sum, value) => sum + value, 0);
    return totalB - totalA;
  });

  const tableRows: TableRow[] = [];
  Object.keys(wilayahMap)
    .sort()
    .forEach((wilayah) => {
      const units = wilayahMap[wilayah];
      const wilayahTotals = statusOrder.reduce((acc, status) => ({ ...acc, [status]: 0 }), {} as Record<string, number>);
      let wilayahSum = 0;
      Object.keys(units).forEach((unit) => {
        statusOrder.forEach((status) => {
          const value = units[unit][status] || 0;
          wilayahTotals[status] += value;
          wilayahSum += value;
        });
      });

      tableRows.push({
        wilayah,
        unit: '',
        ...statusOrder.reduce((acc, status) => ({ ...acc, [status]: wilayahTotals[status] || 0 }), {} as Record<string, number>),
        total: wilayahSum,
        isGroup: true,
      } as TableRow);

      Object.keys(units)
        .sort()
        .forEach((unit, idx) => {
          const counts = units[unit];
          const unitTotal = statusOrder.reduce((sum, status) => sum + (counts[status] || 0), 0);
          const row = {
            wilayah,
            unit,
            ...statusOrder.reduce((acc, status) => ({ ...acc, [status]: counts[status] || 0 }), {} as Record<string, number>),
            total: unitTotal,
            no: idx + 1,
          } as TableRow;
          tableRows.push(row);
        });
    });

  return {
    statusCounts: statusOrder.reduce((acc, key) => ({ ...acc, [key]: statusCounts[key] || 0 }), {} as Record<string, number>),
    genderCounts,
    maritalCounts,
    unitLabelsStatus,
    unitDatasetsStatus: makeDatasets(unitStatusMap, unitLabelsStatus, statusOrder, statusLabels, statusColors),
    unitDatasetsGender: makeDatasets(unitGenderMap, unitLabelsStatus, genderOrder, genderLabels, genderColors),
    unitDatasetsMarital: makeDatasets(unitMaritalMap, unitLabelsStatus, maritalOrder, maritalLabels, maritalColors),
    rumpunLabelsStatus,
    rumpunDatasetsStatus: makeDatasets(rumpunStatusMap, rumpunLabelsStatus, statusOrder, statusLabels, statusColors),
    rumpunDatasetsGender: makeDatasets(rumpunGenderMap, rumpunLabelsStatus, genderOrder, genderLabels, genderColors),
    rumpunDatasetsMarital: makeDatasets(rumpunMaritalMap, rumpunLabelsStatus, maritalOrder, maritalLabels, maritalColors),
    pendidikanLabelsStatus,
    pendidikanDatasetsStatus: makeDatasets(pendidikanStatusMap, pendidikanLabelsStatus, statusOrder, statusLabels, statusColors),
    pendidikanDatasetsGender: makeDatasets(pendidikanGenderMap, pendidikanLabelsStatus, genderOrder, genderLabels, genderColors),
    pendidikanDatasetsMarital: makeDatasets(pendidikanMaritalMap, pendidikanLabelsStatus, maritalOrder, maritalLabels, maritalColors),
    tableRows,
  };
};

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(getStoredUser());
  const [mounted, setMounted] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>('status');
  const [tableFilter, setTableFilter] = useState('');
  const [statusMessage, setStatusMessage] = useState('memuat...');
  const [lastUpdated, setLastUpdated] = useState('memuat...');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const statusChartRef = useRef<ChartJS | null>(null);
  const ukpdChartRef = useRef<ChartJS | null>(null);
  const pendidikanChartRef = useRef<ChartJS | null>(null);
  const rumpunChartRef = useRef<ChartJS | null>(null);
  const scrollProgRef = useRef<HTMLDivElement | null>(null);

  const isReady = mounted && !!user;
  const role = isReady ? normalizeRole(user?.role) : 'ukpd';
  const menuItems = useMemo(() => {
    return navItems.filter((item) => {
      if (!item.roles || item.roles.length === 0) return true;
      return item.roles.includes(role);
    });
  }, [role]);

  const displayRole = mounted ? roleLabel(role) : 'Pengguna';
  const displayUkpd = mounted ? user?.nama_ukpd || 'Pengguna' : 'Pengguna';

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
    fetchData(user, role);
  }, [user, role]);

  useEffect(() => {
    if (dashboardData) {
      renderCharts(dashboardData);
    }
  }, [chartMode, dashboardData]);

  useEffect(() => {
    const updateProg = () => {
      const prog = scrollProgRef.current;
      if (!prog || typeof window === 'undefined') return;
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const pct = height ? Math.max(0, Math.min(1, scrollY / height)) * 100 : 0;
      prog.style.width = `${pct}%`;
    };
    updateProg();
    window.addEventListener('scroll', updateProg, { passive: true });
    return () => window.removeEventListener('scroll', updateProg);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchData = async (currentUser: ReturnType<typeof getStoredUser>, currentRole: string) => {
    setStatusMessage('Memuat data...');
    setLastUpdated('memuat...');
    try {
      const params: NonNullable<Parameters<typeof getDashboardStats>[0]> = {};
      if (currentRole === 'ukpd' && currentUser?.nama_ukpd) {
        params.unit = currentUser.nama_ukpd;
      } else if (currentRole === 'wilayah' && currentUser?.wilayah) {
        params.wilayah = currentUser.wilayah;
      }

      const response = await getDashboardStats(params);
      const payload = response?.data;
      if (!payload?.ok) {
        throw new Error(payload?.error || 'Gagal memuat data.');
      }
      const total = Number(payload?.total) || 0;
      const prepared = prepareStats(payload);
      setDashboardData(prepared);
      setStatusMessage(`Data dimuat: ${total.toLocaleString('id-ID')} baris.`);
      setLastUpdated(new Date().toLocaleTimeString('id-ID'));
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Gagal memuat data.';
      setStatusMessage(`Gagal memuat data: ${message}`);
    }
  };

  const destroyChart = (ref: React.MutableRefObject<ChartJS | null>) => {
    if (ref.current) {
      ref.current.destroy();
      ref.current = null;
    }
  };

  const visibleTotal = (chart: ChartJS | null, datasetIndex: number) => {
    if (!chart) return 1;
    const dataset = chart.data.datasets[datasetIndex];
    return (dataset?.data || []).reduce((sum, value, idx) => {
      if (chart.getDataVisibility(idx)) {
        return sum + (Number(value) || 0);
      }
      return sum;
    }, 0) || 1;
  };

  const renderCharts = (data: DashboardData) => {
    if (typeof ChartJS === 'undefined') return;

    const emptyPlugin = {
      id: 'empty',
      afterDraw(chart: any) {
        const total = chart.data.datasets?.reduce((sum: number, dataset: any) => {
          return sum + (dataset.data || []).reduce((acc: number, value: number) => acc + (Number(value) || 0), 0);
        }, 0);
        if (total) return;
        const { ctx, chartArea } = chart;
        if (!ctx || !chartArea) return;
        ctx.save();
        ctx.fillStyle = getComputedStyle(document.body).color;
        ctx.globalAlpha = 0.6;
        ctx.textAlign = 'center';
        ctx.font = '600 14px \"Plus Jakarta Sans\", system-ui';
        ctx.fillText('Tidak ada data', (chartArea.left + chartArea.right) / 2, (chartArea.top + chartArea.bottom) / 2);
        ctx.restore();
      },
    };

    ChartJS.register(emptyPlugin);

    const mode = chartMode;
    const statusData =
      mode === 'gender'
        ? {
            labels: genderOrder.map((key) => genderLabels[key]),
            datasets: [
              {
                data: genderOrder.map((key) => data.genderCounts[key] || 0),
                backgroundColor: genderOrder.map((key) => genderColors[key]),
              },
            ],
          }
        : mode === 'marital'
        ? {
            labels: maritalOrder.map((key) => maritalLabels[key]),
            datasets: [
              {
                data: maritalOrder.map((key) => data.maritalCounts[key] || 0),
                backgroundColor: maritalOrder.map((key) => maritalColors[key]),
              },
            ],
          }
        : {
            labels: statusOrder.map((key) => statusLabels[key]),
            datasets: [
              {
                data: statusOrder.map((key) => data.statusCounts[key] || 0),
                backgroundColor: statusOrder.map((key) => statusColors[key]),
              },
            ],
          };

    const unitLabels = data.unitLabelsStatus;
    const pendidikanLabels = data.pendidikanLabelsStatus;
    const rumpunLabels = data.rumpunLabelsStatus;

    const barDatasets = {
      status: data.unitDatasetsStatus,
      gender: data.unitDatasetsGender,
      marital: data.unitDatasetsMarital,
    };

    const pendidikanDatasets = {
      status: data.pendidikanDatasetsStatus,
      gender: data.pendidikanDatasetsGender,
      marital: data.pendidikanDatasetsMarital,
    };

    const rumpunDatasets = {
      status: data.rumpunDatasetsStatus,
      gender: data.rumpunDatasetsGender,
      marital: data.rumpunDatasetsMarital,
    };

    const gridColor = '#e5e7eb';
    const commonAnim = { duration: 800, easing: 'easeOutQuart' };

    const statusCtx = document.getElementById('statusChart') as HTMLCanvasElement;
    if (statusCtx) {
      destroyChart(statusChartRef);
      statusChartRef.current = new ChartJS(statusCtx, {
        type: 'doughnut',
        data: statusData,
        options: {
          responsive: true,
          cutout: '58%',
          plugins: {
            legend: { position: 'bottom' },
            datalabels: {
              color: '#fff',
              font: { weight: 'bold' },
              formatter(value: number, ctx: any) {
                const tot = visibleTotal(ctx.chart, ctx.datasetIndex);
                const percentage = ((value / tot) * 100).toFixed(1);
                return Number(percentage) >= 4 ? `${percentage}%` : '';
              },
            },
            tooltip: {
              callbacks: {
                label(context: any) {
                  const value = Number(context.raw) || 0;
                  const totalTooltip = visibleTotal(context.chart, context.datasetIndex);
                  const pct = ((value / totalTooltip) * 100).toFixed(1);
                  return `${context.label}: ${value.toLocaleString('id-ID')} (${pct}%)`;
                },
              },
            },
            empty: {},
          },
          animation: { animateRotate: true, ...commonAnim },
        },
      });
    }

    const ukpdCtx = document.getElementById('ukpdChart') as HTMLCanvasElement;
    if (ukpdCtx) {
      destroyChart(ukpdChartRef);
      ukpdChartRef.current = new ChartJS(ukpdCtx, {
        type: 'bar',
        data: {
          labels: unitLabels,
          datasets: JSON.parse(JSON.stringify(barDatasets[mode])),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true, grid: { color: gridColor }, ticks: { autoSkip: false, maxRotation: 60 } },
            y: { stacked: true, beginAtZero: true, grid: { color: gridColor } },
          },
          plugins: {
            legend: { position: 'top', align: 'start', labels: { usePointStyle: true } },
            datalabels: { display: false },
            tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${(Number(ctx.raw) || 0).toLocaleString('id-ID')}` } },
            empty: {},
          },
          animation: commonAnim,
        },
      });
    }

    const pendidikanCtx = document.getElementById('pendidikanChart') as HTMLCanvasElement;
    if (pendidikanCtx) {
      destroyChart(pendidikanChartRef);
      pendidikanChartRef.current = new ChartJS(pendidikanCtx, {
        type: 'bar',
        data: {
          labels: pendidikanLabels,
          datasets: JSON.parse(JSON.stringify(pendidikanDatasets[mode])),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          scales: {
            x: { stacked: true, grid: { color: gridColor } },
            y: { stacked: true, grid: { color: gridColor } },
          },
          plugins: {
            legend: { position: 'top', align: 'start', labels: { usePointStyle: true } },
            datalabels: { display: false },
            tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${(Number(ctx.raw) || 0).toLocaleString('id-ID')}` } },
            empty: {},
          },
          animation: commonAnim,
        },
      });
    }

    const rumpunCtx = document.getElementById('rumpunChart') as HTMLCanvasElement;
    if (rumpunCtx) {
      destroyChart(rumpunChartRef);
      rumpunChartRef.current = new ChartJS(rumpunCtx, {
        type: 'bar',
        data: {
          labels: rumpunLabels,
          datasets: JSON.parse(JSON.stringify(rumpunDatasets[mode])),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true, grid: { color: gridColor } },
            y: { stacked: true, grid: { color: gridColor } },
          },
          plugins: {
            legend: { position: 'top', align: 'start', labels: { usePointStyle: true } },
            datalabels: { display: false },
            tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${(Number(ctx.raw) || 0).toLocaleString('id-ID')}` } },
            empty: {},
          },
          animation: commonAnim,
        },
      });
    }
  };

  const downloadChart = (chartId: string, fileName: string) => {
    const canvas = document.getElementById(chartId) as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${fileName}.png`;
    link.click();
  };

  const filteredRows =
    dashboardData?.tableRows.filter((row) => {
      if (!tableFilter) return true;
      const needle = tableFilter.toLowerCase();
      const haystack = `${row.unit} ${row.wilayah}`.toLowerCase();
      return haystack.includes(needle);
    }) || [];

  const totals = statusOrder.reduce((acc, status) => {
    acc[status] = filteredRows
      .filter((row) => !row.isGroup)
      .reduce((sum, row) => sum + Number(row[status as keyof TableRow] || 0), 0);
    return acc;
  }, {} as Record<string, number>);

  const totalAll = filteredRows.filter((row) => !row.isGroup).reduce((sum, row) => sum + (row.total || 0), 0);

  const kpiTotal = statusOrder.reduce((sum, status) => sum + (dashboardData?.statusCounts[status] || 0), 0);

  const statusChartTitle =
    chartMode === 'gender'
      ? 'Distribusi Pegawai per Jenis Kelamin (Aktif)'
      : chartMode === 'marital'
      ? 'Distribusi Pegawai per Status Pernikahan (Aktif)'
      : 'Distribusi Pegawai per Status (Aktif)';
  const ukpdTitle =
    chartMode === 'gender'
      ? 'Distribusi Pegawai per UKPD (Jenis Kelamin)'
      : chartMode === 'marital'
      ? 'Distribusi Pegawai per UKPD (Status Pernikahan)'
      : 'Distribusi Pegawai per UKPD (Aktif)';
const pendidikanTitle =
  chartMode === 'gender'
      ? 'Distribusi Pegawai per Jenjang Pendidikan (SK Pangkat, Jenis Kelamin)'
      : chartMode === 'marital'
      ? 'Distribusi Pegawai per Jenjang Pendidikan (SK Pangkat, Status Pernikahan)'
      : 'Distribusi Pegawai per Jenjang Pendidikan (SK Pangkat, Aktif)';
  const rumpunTitle =
    chartMode === 'gender'
      ? 'Rumpun x Jenis Kelamin Pegawai'
      : chartMode === 'marital'
      ? 'Rumpun x Status Pernikahan Pegawai'
      : 'Rumpun x Status Pegawai (Aktif)';

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <>
      <Head>
        <title>Dashboard Dinas Kesehatan</title>
        <link rel="icon" href="/foto/Dinkes.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>
      
      <div className="pegawai-page dashboard-page">
        <div id="scrollProg" ref={scrollProgRef}></div>
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
          <div className="content" id="mainWrap">
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
            <main id="contentRoot">
              <section className="page">
                <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
                  {statusOrder.map((status) => {
                    const count = dashboardData?.statusCounts[status] || 0;
                    const percentage = kpiTotal ? Math.min(100, (count / kpiTotal) * 100) : 0;
                    const badgeText = status
                      .split(' ')
                      .map((word) => word[0])
                      .join('')
                      .slice(0, 3)
                      .toUpperCase();
                    return (
                      <div key={status} className="card text-white shadow-soft" style={{ backgroundImage: statusGradients[status] ?? statusGradients.PNS }}>
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-white/20 grid place-items-center text-lg font-bold">{badgeText}</div>
                          <div>
                            <p className="text-xs/4 opacity-90">Jenis Pegawai</p>
                            <p className="text-sm font-semibold">{status}</p>
                          </div>
                        </div>
                        <div className="mt-3 text-3xl font-bold">{count.toLocaleString('id-ID')}</div>
                        <div className="kpi-progress">
                          <span style={{ width: `${percentage}%` }}></span>
                        </div>
                        <div className="kpi-meta">
                          <span className="kpi-dot" aria-hidden="true"></span>
                          update: {lastUpdated}
                        </div>
                      </div>
                    );
                  })}
                </section>
                <div className="flex items-center justify-end gap-2 text-sm text-slate-600">
                  <span>Tampilan chart:</span>
                  <select value={chartMode} onChange={(event) => setChartMode(event.target.value as ChartMode)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <option value="status">Status Pegawai</option>
                    <option value="gender">Jenis Kelamin</option>
                    <option value="marital">Status Pernikahan</option>
                  </select>
                </div>
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="card">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold" id="statusTitle">
                        {statusChartTitle}
                      </h3>
                      <button type="button" onClick={() => downloadChart('statusChart', 'status')} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100">
                        Unduh PNG
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-center" style={{ height: 'var(--h-status)' }}>
                      <canvas id="statusChart" className="max-w-[640px] w-full h-full"></canvas>
                    </div>
                  </div>
                  <div className="card">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold" id="ukpdTitle">
                        {ukpdTitle}
                      </h3>
                      <button type="button" onClick={() => downloadChart('ukpdChart', 'ukpd')} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100">
                        Unduh PNG
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-center" style={{ height: 'var(--h-ukpd)' }}>
                      <canvas id="ukpdChart" className="w-full h-full"></canvas>
                    </div>
                  </div>
                </section>
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="card">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold" id="pendidikanTitle">
                        {pendidikanTitle}
                      </h3>
                      <button type="button" onClick={() => downloadChart('pendidikanChart', 'pendidikan')} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100">
                        Unduh PNG
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-center" style={{ height: 'var(--h-rumpun)' }}>
                      <canvas id="pendidikanChart" className="w-full h-full"></canvas>
                    </div>
                  </div>
                  <div className="card">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold" id="rumpunTitle">
                        {rumpunTitle}
                      </h3>
                      <button type="button" onClick={() => downloadChart('rumpunChart', 'rumpun')} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100">
                        Unduh PNG
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-center" style={{ height: 'var(--h-rumpun)' }}>
                      <canvas id="rumpunChart" className="w-full h-full"></canvas>
                    </div>
                  </div>
                </section>
                <section className="card">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="text-sm font-semibold">Daftar UKPD (Aktif)</h3>
                    <input
                      type="search"
                      placeholder="Cari UKPD..."
                      value={tableFilter}
                      onChange={(event) => setTableFilter(event.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div className="overflow-x-auto mt-2">
                    <table className="min-w-full text-sm" id="ukpdTable">
                      <thead className="sticky top-0 bg-white border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2 text-center w-16">NO</th>
                          <th className="px-3 py-2 text-left">Nama UKPD</th>
                          <th className="px-3 py-2 text-center">PNS</th>
                          <th className="px-3 py-2 text-center">CPNS</th>
                          <th className="px-3 py-2 text-center">PPPK</th>
                          <th className="px-3 py-2 text-center">PROFESIONAL</th>
                          <th className="px-3 py-2 text-center">PJLP</th>
                          <th className="px-3 py-2 text-center">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-3 py-4 text-center text-slate-500">
                              Data tidak tersedia.
                            </td>
                          </tr>
                        )}
                        {filteredRows.map((row, index) => {
                          const rowKey = row.isGroup ? `${row.wilayah}-group-${index}` : `${row.wilayah}-${row.unit}-${index}`;
                          const unitLabel = row.isGroup ? `Wilayah: ${row.wilayah}` : row.unit || '-';
                          const rowClass = row.isGroup
                            ? 'bg-slate-50 font-semibold border-b border-slate-100'
                            : 'border-b border-slate-100 hover:bg-slate-50';
                          return (
                            <tr key={rowKey} className={rowClass}>
                              <td className="px-3 py-2 text-center">{row.isGroup ? '-' : row.no}</td>
                              <td className="px-3 py-2">{unitLabel}</td>
                              {statusOrder.map((status) => (
                                <td key={status} className="px-3 py-2 text-center">
                                  {(Number(row[status as keyof TableRow] || 0)).toLocaleString('id-ID')}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-center font-semibold">{(row.total || 0).toLocaleString('id-ID')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-sky-50 font-semibold border-t-2 border-slate-200">
                          <td className="px-3 py-2 text-right" colSpan={2}>
                            Total Keseluruhan
                          </td>
                          {statusOrder.map((status) => (
                            <td key={status} className="px-3 py-2 text-center">
                              {totals[status].toLocaleString('id-ID')}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-center">{totalAll.toLocaleString('id-ID')}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>
                <div className="text-center">
                  <Link href="/" className="text-blue-600 hover:text-blue-800 font-semibold">
                    Kembali ke Halaman Utama
                  </Link>
                </div>
              </section>
            </main>
            <footer className="footer">(c) 2025 SI Data Informasi dan Layanan Kepegawaian.</footer>
          </div>
        </div>
      </div>
    </>
  );
}
