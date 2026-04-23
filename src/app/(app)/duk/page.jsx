"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import DataTable from "@/components/tables/DataTable";
import SearchFilterBar from "@/components/forms/SearchFilterBar";

const PANGKAT_RANK = [
  ["IV/e", "iv/e", "pembina utama"],
  ["IV/d", "iv/d", "pembina utama madya"],
  ["IV/c", "iv/c", "pembina utama muda"],
  ["IV/b", "iv/b", "pembina tk.i", "pembina tingkat i"],
  ["IV/a", "iv/a", "pembina"],
  ["III/d", "iii/d", "penata tk.i", "penata tingkat i"],
  ["III/c", "iii/c", "penata"],
  ["III/b", "iii/b", "penata muda tk.i", "penata muda tingkat i"],
  ["III/a", "iii/a", "penata muda"],
  ["II/d", "ii/d", "pengatur tk.i", "pengatur tingkat i"],
  ["II/c", "ii/c", "pengatur"],
  ["II/b", "ii/b", "pengatur muda tk.i", "pengatur muda tingkat i"],
  ["II/a", "ii/a", "pengatur muda"],
  ["I/d", "i/d", "juru tk.i", "juru tingkat i"],
  ["I/c", "i/c", "juru"],
  ["I/b", "i/b", "juru muda tk.i", "juru muda tingkat i"],
  ["I/a", "i/a", "juru muda"]
];

const EDUCATION_RANK = {
  S3: 12,
  SPESIALIS: 11,
  S2: 10,
  PROFESI: 9,
  S1: 8,
  D4: 7,
  D3: 6,
  D2: 5,
  D1: 4,
  "SMA/SMK": 3,
  SMA: 3,
  SMK: 3,
  SMP: 2,
  SD: 1
};

function pangkatRank(value) {
  const text = String(value || "").toLowerCase();
  const index = PANGKAT_RANK.findIndex((aliases) => aliases.some((alias) => text.includes(alias.toLowerCase())));
  return index === -1 ? 999 : index;
}

function educationRank(value) {
  const text = String(value || "").toUpperCase();
  const key = Object.keys(EDUCATION_RANK).find((item) => text.includes(item));
  return key ? EDUCATION_RANK[key] : 0;
}

function timeValue(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) return `"${text.replace(/"/g, "\"\"")}"`;
  return text;
}

export default function DukPage() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [pangkat, setPangkat] = useState("");
  const [jabatan, setJabatan] = useState("");

  useEffect(() => {
    fetch("/api/duk").then((res) => res.json()).then((payload) => setRows(payload.data || []));
  }, []);

  const pangkatOptions = useMemo(() => [...new Set(rows.map((item) => item.pangkat_golongan).filter(Boolean))], [rows]);
  const jabatanOptions = useMemo(() => [...new Set(rows.map((item) => (item.nama_jabatan_menpan || item.nama_jabatan_orb)).filter(Boolean))], [rows]);
  const filtered = rows.filter((item) => {
    const matchSearch = [item.nama, item.nip, item.nama_ukpd].join(" ").toLowerCase().includes(search.toLowerCase());
    return matchSearch && (!pangkat || item.pangkat_golongan === pangkat) && (!jabatan || (item.nama_jabatan_menpan || item.nama_jabatan_orb) === jabatan);
  }).sort((a, b) => (
    pangkatRank(a.pangkat_golongan) - pangkatRank(b.pangkat_golongan)
    || timeValue(a.tmt_pangkat_terakhir) - timeValue(b.tmt_pangkat_terakhir)
    || educationRank(b.jenjang_pendidikan) - educationRank(a.jenjang_pendidikan)
    || String(a.nama || "").localeCompare(String(b.nama || ""))
  ));

  function exportDuk() {
    const headers = ["No", "Nama", "NIP", "Pangkat/Gol", "TMT Pangkat", "Jabatan", "Pendidikan", "Unit Kerja"];
    const lines = [
      headers.map(escapeCsv).join(","),
      ...filtered.map((item, index) => [
        index + 1,
        item.nama,
        item.nip,
        item.pangkat_golongan,
        item.tmt_pangkat_terakhir,
        item.nama_jabatan_menpan || item.nama_jabatan_orb,
        [item.jenjang_pendidikan, item.program_studi].filter(Boolean).join(" - "),
        item.nama_ukpd
      ].map(escapeCsv).join(","))
    ];
    const blob = new Blob(["\uFEFF", lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "daftar-urut-kepangkatan.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Daftar Urut Kepangkatan"
        description="Urutan berdasarkan pangkat tertinggi, TMT pangkat terlama, lalu pendidikan tertinggi."
        breadcrumbs={[{ label: "DUK" }]}
        action={<button className="btn-secondary" type="button" onClick={exportDuk}><Download className="h-4 w-4" /> Export Excel</button>}
      />
      <SearchFilterBar
        search={search}
        onSearch={setSearch}
        filters={[
          { name: "pangkat", label: "Semua pangkat", value: pangkat, onChange: setPangkat, options: pangkatOptions },
          { name: "jabatan", label: "Semua jabatan", value: jabatan, onChange: setJabatan, options: jabatanOptions }
        ]}
      />
      <div className="mt-5">
        <DataTable
          rowKey="id_pegawai"
          data={filtered}
          showNumber
          columns={[
            {
              key: "nama",
              header: "Nama",
              cellClassName: "min-w-[220px] whitespace-normal font-medium text-slate-900"
            },
            {
              key: "nip",
              header: "NIP",
              headerClassName: "w-[170px]",
              cellClassName: "w-[170px]"
            },
            {
              key: "pangkat_golongan",
              header: "Pangkat/Gol",
              headerClassName: "w-[180px]",
              cellClassName: "w-[180px] whitespace-normal"
            },
            {
              key: "tmt_pangkat_terakhir",
              header: "TMT Pangkat",
              headerClassName: "w-[130px]",
              cellClassName: "w-[130px]"
            },
            {
              key: "nama_jabatan_menpan",
              header: "Jabatan",
              render: (item) => item.nama_jabatan_menpan || item.nama_jabatan_orb || "-",
              cellClassName: "min-w-[240px] whitespace-normal"
            },
            {
              key: "jenjang_pendidikan",
              header: "Pendidikan",
              render: (item) => (
                <div className="whitespace-normal">
                  <div className="font-medium text-slate-900">{item.jenjang_pendidikan || "-"}</div>
                  <div className="text-xs text-slate-500">{item.program_studi || "-"}</div>
                </div>
              ),
              cellClassName: "min-w-[180px]"
            },
            {
              key: "nama_ukpd",
              header: "Unit Kerja",
              cellClassName: "min-w-[220px] whitespace-normal"
            }
          ]}
        />
      </div>
    </>
  );
}
