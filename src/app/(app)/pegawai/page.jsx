"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Edit, Eye, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import DataTable from "@/components/tables/DataTable";
import SearchFilterBar from "@/components/forms/SearchFilterBar";
import StatusBadge from "@/components/ui/StatusBadge";
import ConfirmDeleteModal from "@/components/ui/ConfirmDeleteModal";
import { WILAYAH } from "@/lib/constants/roles";
import { JENIS_PEGAWAI_OPTIONS } from "@/lib/helpers/pegawaiStatus";

function displayNip(item) {
  return item.nip || "-";
}

export default function PegawaiPage() {
  const [rows, setRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [ukpdOptions, setUkpdOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [wilayah, setWilayah] = useState("");
  const [ukpd, setUkpd] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ q: search, status, wilayah, ukpd, page: String(page), pageSize: String(pageSize) });
    setLoading(true);
    fetch(`/api/pegawai?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((payload) => {
        const data = payload.data || {};
        setRows(data.rows || []);
        setTotalRows(data.total || 0);
        setUkpdOptions(data.filters?.ukpdOptions || []);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setRows([]);
          setTotalRows(0);
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [search, status, wilayah, ukpd, page, pageSize]);

  const maxPage = Math.max(1, Math.ceil(totalRows / pageSize));

  async function removePegawai() {
    await fetch(`/api/pegawai/${deleteTarget.id_pegawai}`, { method: "DELETE" });
    setRows((current) => current.filter((item) => item.id_pegawai !== deleteTarget.id_pegawai));
    setTotalRows((current) => Math.max(0, current - 1));
    setDeleteTarget(null);
  }

  function escapeCsv(value) {
    const text = String(value ?? "");
    if (text.includes(",") || text.includes("\"") || text.includes("\n")) return `"${text.replace(/"/g, "\"\"")}"`;
    return text;
  }

  async function exportPegawai() {
    const params = new URLSearchParams({ q: search, status, wilayah, ukpd, export: "1" });
    const payload = await fetch(`/api/pegawai?${params}`).then((res) => res.json());
    const exportRows = payload.data?.rows || [];
    const headers = ["No", "Nama", "NIP", "Jabatan Kepmenpan 11", "Status", "Nama UKPD", "Wilayah"];
    const lines = [
      headers.map(escapeCsv).join(","),
      ...exportRows.map((item, index) => [
        index + 1,
        item.nama,
        item.nip || "",
        item.nama_jabatan_menpan || item.nama_jabatan_orb || "",
        item.jenis_pegawai || "",
        item.nama_ukpd || "",
        item.wilayah || ""
      ].map(escapeCsv).join(","))
    ];
    const blob = new Blob(["\uFEFF", lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "data-pegawai.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const columns = [
    { key: "nama", header: "Nama" },
    { key: "nip", header: "NIP", render: displayNip },
    { key: "nama_jabatan_menpan", header: "Jabatan Kepmenpan 11", render: (item) => item.nama_jabatan_menpan || item.nama_jabatan_orb || "-" },
    { key: "jenis_pegawai", header: "Status", render: (item) => <StatusBadge status={item.jenis_pegawai} /> },
    { key: "nama_ukpd", header: "Nama UKPD" }
  ];

  return (
    <>
      <PageHeader
        title="Data Pegawai"
        description="Kelola data pegawai dengan filter berbasis role. Admin wilayah dan UKPD tetap dibatasi oleh API."
        breadcrumbs={[{ label: "Data Pegawai" }]}
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" type="button" onClick={exportPegawai}><Download className="h-4 w-4" /> Export Excel</button>
            <Link className="btn-primary" href="/pegawai/new"><Plus className="h-4 w-4" /> Tambah Pegawai</Link>
          </div>
        }
      />
      <SearchFilterBar
        search={search}
        onSearch={(value) => { setSearch(value); setPage(1); }}
        filters={[
          { name: "status", label: "Semua status", value: status, onChange: (value) => { setStatus(value); setPage(1); }, options: JENIS_PEGAWAI_OPTIONS },
          { name: "wilayah", label: "Semua wilayah", value: wilayah, onChange: (value) => { setWilayah(value); setPage(1); }, options: WILAYAH },
          { name: "ukpd", label: "Semua UKPD", value: ukpd, onChange: (value) => { setUkpd(value); setPage(1); }, options: ukpdOptions }
        ]}
      />
      <div className="mt-5">
        {loading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-white" />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            rowKey="id_pegawai"
            showNumber
            startNumber={(page - 1) * pageSize + 1}
            actions={(item) => (
              <div className="flex items-center gap-2">
                <Link className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-dinkes-700 hover:bg-dinkes-50 focus-ring" href={`/pegawai/${item.id_pegawai}`} target="_blank" rel="noopener noreferrer" aria-label="Lihat profil" title="Lihat profil">
                  <Eye className="h-4 w-4" />
                  <span className="hidden lg:inline">Lihat Profil</span>
                </Link>
                <Link className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-slate-700 hover:bg-slate-100 focus-ring" href={`/pegawai/${item.id_pegawai}/edit`} aria-label="Edit" title="Edit">
                  <Edit className="h-4 w-4" />
                  <span className="hidden lg:inline">Edit</span>
                </Link>
                <button className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-rose-600 hover:bg-rose-50 focus-ring" onClick={() => setDeleteTarget(item)} aria-label="Hapus" title="Hapus">
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden lg:inline">Hapus</span>
                </button>
              </div>
            )}
          />
        )}
      </div>
      <footer className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <span>Menampilkan {rows.length} dari {totalRows} pegawai</span>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span>Per halaman</span>
            <select
              className="input py-2"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {[10, 25, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <button className="btn-secondary py-2" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Sebelumnya</button>
          <span className="px-2">Hal {page} / {maxPage}</span>
          <button className="btn-secondary py-2" disabled={page === maxPage} onClick={() => setPage((value) => Math.min(maxPage, value + 1))}>Berikutnya</button>
        </div>
      </footer>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Hapus data pegawai?"
        description={`Data ${deleteTarget?.nama || ""} akan dihapus dari database.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removePegawai}
      />
    </>
  );
}
