import { filterPegawaiByRole, getPegawaiWilayah } from "@/lib/auth/access";
import { requireAuth } from "@/lib/auth/requireAuth";
import { getPegawaiDashboardData, getUkpdData } from "@/lib/data/pegawaiStore";
import { ok } from "@/lib/helpers/response";
import { JENIS_PEGAWAI_OPTIONS, isJenisPegawai, normalizeJenisPegawai } from "@/lib/helpers/pegawaiStatus";

const DASHBOARD_CACHE_TTL_MS = 60 * 1000;
const dashboardCache = new Map();

function getDashboardCacheKey(user) {
  return [user?.role || "-", user?.nama_ukpd || "-", user?.wilayah || "-"].join("|");
}

function countBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item) || "-";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function toChart(obj) {
  return { labels: Object.keys(obj), values: Object.values(obj) };
}

const CHART_VIEW_CONFIGS = {
  statusPegawai: {
    label: "Status Pegawai",
    titleSuffix: "Status",
    field: "jenis_pegawai",
    categories: [
      { key: "PNS", label: "PNS", color: "#18a8e0" },
      { key: "CPNS", label: "CPNS", color: "#13a8be" },
      { key: "PPPK", label: "PPPK", color: "#22c55e" },
      { key: "NON PNS", label: "PROFESIONAL", color: "#14b8a6" },
      { key: "PJLP", label: "PJLP", color: "#10b981" },
      { key: "PPPK Paruh Waktu", label: "PPPK Paruh Waktu", color: "#8b5cf6" }
    ],
    normalize: normalizeJenisPegawai
  },
  jenisKelamin: {
    label: "Jenis Kelamin",
    titleSuffix: "Jenis Kelamin",
    field: "jenis_kelamin",
    categories: [
      { key: "Laki-laki", label: "Laki-laki", color: "#18a8e0" },
      { key: "Perempuan", label: "Perempuan", color: "#f97316" }
    ],
    normalize(value) {
      const text = String(value || "").trim().toLowerCase();
      if (text.includes("laki")) return "Laki-laki";
      if (text.includes("perempuan") || text === "p") return "Perempuan";
      return "";
    }
  },
  statusPernikahan: {
    label: "Status Pernikahan",
    titleSuffix: "Status Pernikahan",
    field: "status_perkawinan",
    categories: [
      { key: "Belum Menikah", label: "Belum Menikah", color: "#18a8e0" },
      { key: "Menikah", label: "Menikah", color: "#22c55e" },
      { key: "Cerai Hidup", label: "Cerai Hidup", color: "#f97316" },
      { key: "Cerai Mati", label: "Cerai Mati", color: "#ef4444" }
    ],
    normalize(value) {
      const text = String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
      if (!text) return "";
      if (text.includes("BELUM")) return "Belum Menikah";
      if (text.includes("CERAI") && text.includes("MATI")) return "Cerai Mati";
      if (text.includes("CERAI")) return "Cerai Hidup";
      if (text.includes("MENIKAH") || text.includes("KAWIN")) return "Menikah";
      return "";
    }
  }
};

function createSeriesChart(labels, categories, counts) {
  return {
    labels,
    datasets: categories.map((category) => ({
      label: category.label,
      backgroundColor: category.color,
      data: labels.map((label) => counts.get(`${label}||${category.key}`) || 0)
    }))
  };
}

function buildGroupedChart(items, groupFn, config, sortByTotal = true) {
  const groupTotals = new Map();
  const counts = new Map();

  for (const item of items) {
    const group = groupFn(item) || "Tidak Diketahui";
    const category = config.normalize(item[config.field]);
    if (!category || !config.categories.some((option) => option.key === category)) continue;
    groupTotals.set(group, (groupTotals.get(group) || 0) + 1);
    counts.set(`${group}||${category}`, (counts.get(`${group}||${category}`) || 0) + 1);
  }

  const labels = [...groupTotals.entries()]
    .sort((a, b) => (sortByTotal ? b[1] - a[1] : 0) || a[0].localeCompare(b[0]))
    .map(([label]) => label);

  return createSeriesChart(labels, config.categories, counts);
}

function buildDistributionChart(items, config) {
  const counts = new Map(config.categories.map((category) => [category.key, 0]));
  for (const item of items) {
    const category = config.normalize(item[config.field]);
    if (counts.has(category)) counts.set(category, counts.get(category) + 1);
  }

  return {
    labels: config.categories.map((category) => category.label),
    values: config.categories.map((category) => counts.get(category.key) || 0),
    colors: config.categories.map((category) => category.color)
  };
}

function buildChartViews(items) {
  return Object.fromEntries(Object.entries(CHART_VIEW_CONFIGS).map(([key, config]) => [
    key,
    {
      label: config.label,
      titles: {
        distribution: `Distribusi Pegawai per ${config.titleSuffix} (Aktif)`,
        ukpd: `Distribusi Pegawai per UKPD (${config.titleSuffix})`,
        pendidikan: `Distribusi Pegawai per Jenjang Pendidikan (${config.titleSuffix})`,
        rumpun: `Rumpun A - ${config.titleSuffix} Pegawai`
      },
      distribution: buildDistributionChart(items, config),
      ukpd: buildGroupedChart(items, (item) => item.nama_ukpd, config, false),
      pendidikan: buildGroupedChart(items, (item) => item.jenjang_pendidikan, config),
      rumpun: buildGroupedChart(items, (item) => item.status_rumpun, config)
    }
  ]));
}

function sortByCount(rows) {
  return rows.sort((a, b) => b.jumlah - a.jumlah || String(a.label || a.nama_ukpd).localeCompare(String(b.label || b.nama_ukpd)));
}

function buildDashboardAnalytics(data, ukpdList) {
  const ukpdMap = new Map();
  const rumpunMap = new Map();
  const jabatanMenpanMap = new Map();
  const officialUkpdById = new Map(ukpdList.map((ukpd) => [Number(ukpd.id_ukpd), ukpd]));
  const officialUkpdByName = new Map(ukpdList.map((ukpd) => [ukpd.nama_ukpd, ukpd]));

  for (const item of data) {
    const jenisPegawai = normalizeJenisPegawai(item.jenis_pegawai);
    const officialUkpd = officialUkpdById.get(Number(item.id_ukpd)) || officialUkpdByName.get(item.nama_ukpd);
    const ukpdKey = officialUkpd?.id_ukpd || item.id_ukpd || item.nama_ukpd || "Tidak Diketahui";
    const namaUkpd = officialUkpd?.nama_ukpd || item.nama_ukpd || "Tidak Diketahui";
    const wilayah = officialUkpd?.wilayah || getPegawaiWilayah(item, ukpdList);

    if (!ukpdMap.has(ukpdKey)) {
      ukpdMap.set(ukpdKey, {
        id_ukpd: officialUkpd?.id_ukpd || item.id_ukpd,
        nama_ukpd: namaUkpd,
        wilayah,
        jenis_ukpd: officialUkpd?.jenis_ukpd || item.jenis_ukpd || "-",
        total: 0,
        byJenisPegawai: Object.fromEntries(JENIS_PEGAWAI_OPTIONS.map((option) => [option, 0]))
      });
    }
    const ukpd = ukpdMap.get(ukpdKey);
    ukpd.total += 1;
    ukpd.byJenisPegawai[jenisPegawai] = (ukpd.byJenisPegawai[jenisPegawai] || 0) + 1;

    const rumpun = item.status_rumpun || "Tidak Diketahui";
    const rumpunKey = `${jenisPegawai}||${rumpun}`;
    rumpunMap.set(rumpunKey, {
      jenis_pegawai: jenisPegawai,
      rumpun_jabatan: rumpun,
      jumlah: (rumpunMap.get(rumpunKey)?.jumlah || 0) + 1
    });

    const jabatan = item.nama_jabatan_menpan || "Tidak Diketahui";
    const jabatanKey = `${jenisPegawai}||${jabatan}`;
    jabatanMenpanMap.set(jabatanKey, {
      jenis_pegawai: jenisPegawai,
      jabatan_kepmenpan_11: jabatan,
      jumlah: (jabatanMenpanMap.get(jabatanKey)?.jumlah || 0) + 1
    });
  }

  return {
    jenisPegawaiOptions: JENIS_PEGAWAI_OPTIONS,
    ukpdSummary: [...ukpdMap.values()].sort((a, b) => b.total - a.total || a.nama_ukpd.localeCompare(b.nama_ukpd)),
    rumpunByJenisPegawai: sortByCount([...rumpunMap.values()].map((row) => ({ ...row, label: row.rumpun_jabatan }))),
    jabatanMenpanByJenisPegawai: sortByCount([...jabatanMenpanMap.values()].map((row) => ({ ...row, label: row.jabatan_kepmenpan_11 })))
  };
}

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const cacheKey = getDashboardCacheKey(user);
  const cached = dashboardCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return ok(cached.payload);
  }

  const [pegawaiMaster, ukpdList] = await Promise.all([getPegawaiDashboardData(), getUkpdData()]);
  const data = filterPegawaiByRole(pegawaiMaster, user, ukpdList);
  const summary = {
    total: data.length,
    pnsCpns: data.filter((item) => ["PNS", "CPNS"].includes(normalizeJenisPegawai(item.jenis_pegawai))).length,
    pppk: data.filter((item) => isJenisPegawai(item, "PPPK")).length,
    pppkParuhWaktu: data.filter((item) => isJenisPegawai(item, "PPPK Paruh Waktu")).length,
    nonPns: data.filter((item) => isJenisPegawai(item, "NON PNS")).length,
    pjlp: data.filter((item) => isJenisPegawai(item, "PJLP")).length
  };

  const visibleUkpd = [...new Set(data.map((item) => item.nama_ukpd))];
  const wilayahUkpd = ukpdList.filter((item) => visibleUkpd.includes(item.nama_ukpd));
  const activeData = data.filter((item) => String(item.kondisi || "").toUpperCase() === "AKTIF");

  const payload = {
    user,
    summary,
    charts: {
      gender: toChart(countBy(data, (item) => item.jenis_kelamin)),
      pendidikan: toChart(countBy(data, (item) => item.jenjang_pendidikan)),
      rumpun: toChart(countBy(data, (item) => item.status_rumpun)),
      wilayah: toChart(countBy(data, getPegawaiWilayah)),
      ukpd: toChart(countBy(data, (item) => item.nama_ukpd))
    },
    chartViews: buildChartViews(activeData.length ? activeData : data),
    latestEmployees: data.slice(0, 5),
    visibleUkpd: wilayahUkpd,
    analytics: buildDashboardAnalytics(data, ukpdList),
    usulanSummary: {
      mutasi: 0,
      putusJf: 0
    }
  };

  dashboardCache.set(cacheKey, {
    payload,
    expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS
  });

  return ok(payload);
}
