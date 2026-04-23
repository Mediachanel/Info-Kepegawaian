"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookUser, BriefcaseMedical, ChevronDown, ChevronRight, Download, FilePlus2, Search, ShieldCheck, UserRoundCheck, UsersRound } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import KpiCard from "@/components/cards/KpiCard";
import DashboardChartCard from "@/components/charts/DashboardChartCard";
import DataTable from "@/components/tables/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";

const analyticsTabs = [
  { id: "ukpd", label: "Daftar UKPD" },
  { id: "rumpun", label: "Rumpun Jabatan" },
  { id: "kepmenpan", label: "Jabatan Kepmenpan 11" }
];

function formatNumber(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function downloadCsv(filename, headers, rows) {
  const content = [
    headers.map((header) => escapeCsv(header)).join(","),
    ...rows.map((row) => row.map((cell) => escapeCsv(cell)).join(","))
  ].join("\n");
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildPivotAggregates(rows, labelKey) {
  const map = new Map();
  for (const row of rows) {
    const label = row[labelKey] || "Tidak Diketahui";
    if (!map.has(label)) {
      map.set(label, {
        label,
        total: 0,
        pnsCpns: 0,
        pppk: 0,
        pppkParuhWaktu: 0,
        nonPns: 0,
        pjlp: 0
      });
    }
    const item = map.get(label);
    const jumlah = Number(row.jumlah || 0);
    item.total += jumlah;
    if (row.jenis_pegawai === "PNS" || row.jenis_pegawai === "CPNS") item.pnsCpns += jumlah;
    if (row.jenis_pegawai === "PPPK") item.pppk += jumlah;
    if (row.jenis_pegawai === "PPPK Paruh Waktu") item.pppkParuhWaktu += jumlah;
    if (row.jenis_pegawai === "NON PNS") item.nonPns += jumlah;
    if (row.jenis_pegawai === "PJLP") item.pjlp += jumlah;
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function AnalyticsTable({ columns, rows, rowKey }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="table-th" scope="col">{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, index) => (
            <tr key={`${row[rowKey] || row.label || "row"}-${index}`} className="hover:bg-dinkes-50/40">
              {columns.map((column) => (
                <td key={column.key} className="table-td">{column.render ? column.render(row, index) : row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <p className="bg-white px-4 py-8 text-center text-sm text-slate-500">Data tidak ditemukan.</p> : null}
    </div>
  );
}

function GroupedUkpdKpiTable({ rows }) {
  const groupedRows = useMemo(() => {
    const groups = new Map();
    for (const row of rows) {
      const wilayah = row.wilayah || "Tidak Diketahui";
      if (!groups.has(wilayah)) groups.set(wilayah, []);
      groups.get(wilayah).push(row);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([wilayah, items]) => [
        wilayah,
        items.sort((a, b) => a.nama_ukpd.localeCompare(b.nama_ukpd))
      ]);
  }, [rows]);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-white">
          <tr>
            <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">NO</th>
            <th className="min-w-72 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">Nama UKPD</th>
            <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">Total Pegawai</th>
            <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">PNS/CPNS</th>
            <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">PPPK</th>
            <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">PPPK Paruh Waktu</th>
            <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">NON PNS</th>
            <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">PJLP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {groupedRows.map(([wilayah, items]) => (
            <Fragment key={wilayah}>
              <tr className="bg-slate-50">
                <td colSpan={8} className="px-4 py-3 text-sm font-bold text-slate-900">
                  <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-rose-500 align-middle" />
                  Wilayah {wilayah}
                </td>
              </tr>
              {items.map((row, index) => {
                const pnsCpns = (row.byJenisPegawai?.PNS || 0) + (row.byJenisPegawai?.CPNS || 0);
                return (
                  <tr key={row.id_ukpd || row.nama_ukpd} className="hover:bg-dinkes-50/40">
                    <td className="whitespace-nowrap px-3 py-3 text-center text-sm text-slate-700">{index + 1}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-slate-700">{row.nama_ukpd}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-sm font-bold text-slate-900">{formatNumber(row.total)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-slate-700">{formatNumber(pnsCpns)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-slate-700">{formatNumber(row.byJenisPegawai?.PPPK)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-slate-700">{formatNumber(row.byJenisPegawai?.["PPPK Paruh Waktu"])}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-slate-700">{formatNumber(row.byJenisPegawai?.["NON PNS"])}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-slate-700">{formatNumber(row.byJenisPegawai?.PJLP)}</td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
      {!rows.length ? <p className="bg-white px-4 py-8 text-center text-sm text-slate-500">Data UKPD tidak ditemukan.</p> : null}
    </div>
  );
}

function PivotCountTable({ rows, labelKey, labelTitle }) {
  const pivotRows = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const label = row[labelKey] || "Tidak Diketahui";
      if (!map.has(label)) {
        map.set(label, {
          label,
          total: 0,
          pnsCpns: 0,
          pppk: 0,
          pppkParuhWaktu: 0,
          nonPns: 0,
          pjlp: 0
        });
      }
      const target = map.get(label);
      const jumlah = Number(row.jumlah || 0);
      target.total += jumlah;
      if (row.jenis_pegawai === "PNS" || row.jenis_pegawai === "CPNS") target.pnsCpns += jumlah;
      if (row.jenis_pegawai === "PPPK") target.pppk += jumlah;
      if (row.jenis_pegawai === "PPPK Paruh Waktu") target.pppkParuhWaktu += jumlah;
      if (row.jenis_pegawai === "NON PNS") target.nonPns += jumlah;
      if (row.jenis_pegawai === "PJLP") target.pjlp += jumlah;
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [labelKey, rows]);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-white">
          <tr>
            <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">NO</th>
            <th className="min-w-[32rem] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">{labelTitle}</th>
            <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">Total Pegawai</th>
            <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">PNS/CPNS</th>
            <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">PPPK</th>
            <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">PPPK Paruh Waktu</th>
            <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">NON PNS</th>
            <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-600">PJLP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {pivotRows.map((row, index) => (
            <tr key={row.label} className="hover:bg-dinkes-50/40">
              <td className="whitespace-nowrap px-3 py-3 text-center text-sm text-slate-700">{index + 1}</td>
              <td className="px-3 py-3 text-sm font-medium text-slate-700">{row.label}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right text-sm font-bold text-slate-900">{formatNumber(row.total)}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-slate-700">{formatNumber(row.pnsCpns)}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-slate-700">{formatNumber(row.pppk)}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-slate-700">{formatNumber(row.pppkParuhWaktu)}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-slate-700">{formatNumber(row.nonPns)}</td>
              <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-slate-700">{formatNumber(row.pjlp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!pivotRows.length ? <p className="bg-white px-4 py-8 text-center text-sm text-slate-500">Data tidak ditemukan.</p> : null}
    </div>
  );
}

function PivotDrillPanel({ mode, query }) {
  const [loadingTree, setLoadingTree] = useState(false);
  const [tree, setTree] = useState([]);
  const [open1, setOpen1] = useState({});
  const [open2, setOpen2] = useState({});
  const [employeesByNode, setEmployeesByNode] = useState({});
  const [loadingNode, setLoadingNode] = useState("");
  const [pageByNode, setPageByNode] = useState({});
  const pageSize = 20;
  const title = mode === "jabatan" ? "Jabatan -> UKPD -> Pegawai" : "Rumpun -> Jabatan -> Pegawai";
  const getCount = (counts, key) => formatNumber(counts?.[key] || 0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ mode });
      if (query) params.set("q", query);
      setLoadingTree(true);
      fetch(`/api/dashboard/pivot-tree?${params.toString()}`)
        .then((res) => res.json())
        .then((payload) => {
          const nextTree = payload?.data?.tree || [];
          setTree(nextTree);
          setOpen1({});
          setOpen2({});
          setEmployeesByNode({});
          setPageByNode({});
        })
        .finally(() => setLoadingTree(false));
    }, 350);

    return () => clearTimeout(timer);
  }, [mode, query]);

  function toggleLevel1(label) {
    setOpen1((current) => ({ ...current, [label]: !current[label] }));
  }

  async function loadEmployees(group1, group2, page = 1) {
    const nodeKey = `${group1}::${group2}`;
    setLoadingNode(nodeKey);
    const params = new URLSearchParams({ mode, group1, group2, page: String(page), pageSize: String(pageSize) });
    if (query) params.set("q", query);
    try {
      const response = await fetch(`/api/dashboard/pivot-tree?${params.toString()}`);
      const payload = await response.json();
      setEmployeesByNode((current) => ({
        ...current,
        [nodeKey]: {
          items: payload?.data?.employees || [],
          total: payload?.data?.total || 0,
          page: payload?.data?.page || page
        }
      }));
      setPageByNode((current) => ({ ...current, [nodeKey]: page }));
    } finally {
      setLoadingNode("");
    }
  }

  async function toggleLevel2(group1, group2) {
    const nodeKey = `${group1}::${group2}`;
    const willOpen = !open2[nodeKey];
    setOpen2((current) => ({ ...current, [nodeKey]: willOpen }));
    if (willOpen) {
      const page = pageByNode[nodeKey] || 1;
      await loadEmployees(group1, group2, page);
    }
  }

  return (
    <section className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <h3 className="text-sm font-semibold text-slate-900">Pivot Drilldown: {title}</h3>
      {loadingTree ? <p className="mt-3 text-sm text-slate-500">Memuat struktur...</p> : null}
      <p className="mt-2 text-xs text-slate-500">Geser horizontal untuk melihat kolom jumlah per jenis pegawai.</p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-[1200px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Row Labels</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Total</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">PNS/CPNS</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">PPPK</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">PPPK Paruh Waktu</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">NON PNS</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">PJLP</th>
            </tr>
          </thead>
          <tbody>
            {tree.map((group1) => {
              const isOpen1 = Boolean(open1[group1.label]);
              return (
                <Fragment key={group1.label}>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <td className="px-3 py-2">
                      <button className="flex items-center gap-1 text-left text-sm font-semibold text-slate-900" onClick={() => toggleLevel1(group1.label)}>
                        {isOpen1 ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span>{group1.label}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-semibold text-slate-900">{formatNumber(group1.total)}</td>
                    <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(group1.counts, "pnsCpns")}</td>
                    <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(group1.counts, "pppk")}</td>
                    <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(group1.counts, "pppkParuhWaktu")}</td>
                    <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(group1.counts, "nonPns")}</td>
                    <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(group1.counts, "pjlp")}</td>
                  </tr>
                  {isOpen1
                    ? group1.children.map((group2) => {
                      const nodeKey = `${group1.label}::${group2.label}`;
                      const isOpen2 = Boolean(open2[nodeKey]);
                      const employeeData = employeesByNode[nodeKey];
                      const totalPages = Math.max(1, Math.ceil((employeeData?.total || 0) / pageSize));
                      return (
                        <Fragment key={nodeKey}>
                          <tr className="border-b border-slate-100">
                            <td className="px-3 py-2">
                              <button className="ml-6 flex items-center gap-1 text-left text-sm font-medium text-slate-800" onClick={() => toggleLevel2(group1.label, group2.label)}>
                                {isOpen2 ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                <span>{group2.label}</span>
                              </button>
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-medium text-slate-900">{formatNumber(group2.total)}</td>
                            <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(group2.counts, "pnsCpns")}</td>
                            <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(group2.counts, "pppk")}</td>
                            <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(group2.counts, "pppkParuhWaktu")}</td>
                            <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(group2.counts, "nonPns")}</td>
                            <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(group2.counts, "pjlp")}</td>
                          </tr>
                          {isOpen2 ? (
                            <>
                              {(employeeData?.items || []).map((employee) => (
                                <tr key={employee.id_pegawai} className="border-b border-slate-100 hover:bg-dinkes-50/40">
                                  <td className="px-3 py-1 text-sm text-slate-700">
                                    <div className="ml-12 flex items-center justify-between gap-3">
                                      <span>{employee.nama} <span className="text-xs text-slate-500">({employee.jenis_pegawai || "-"})</span></span>
                                      <Link className="shrink-0 text-xs font-semibold text-dinkes-700 hover:text-dinkes-900" href={`/pegawai/${employee.id_pegawai}`} target="_blank" rel="noopener noreferrer">
                                        Lihat Profil
                                      </Link>
                                    </div>
                                  </td>
                                  <td className="px-3 py-1 text-right text-xs text-slate-400">-</td>
                                  <td className="px-3 py-1 text-right text-xs text-slate-400">-</td>
                                  <td className="px-3 py-1 text-right text-xs text-slate-400">-</td>
                                  <td className="px-3 py-1 text-right text-xs text-slate-400">-</td>
                                  <td className="px-3 py-1 text-right text-xs text-slate-400">-</td>
                                  <td className="px-3 py-1 text-right text-xs text-slate-400">-</td>
                                </tr>
                              ))}
                              {loadingNode === nodeKey ? (
                                <tr className="border-b border-slate-100">
                                  <td className="px-3 py-2 text-xs text-slate-500" colSpan={7}>
                                    <span className="ml-12">Memuat pegawai...</span>
                                  </td>
                                </tr>
                              ) : null}
                              {(employeeData?.total || 0) > pageSize ? (
                                <tr className="border-b border-slate-100">
                                  <td className="px-3 py-2" colSpan={7}>
                                    <div className="ml-12 flex items-center gap-2 text-xs text-slate-600">
                                      <button
                                        className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50"
                                        disabled={(employeeData?.page || 1) <= 1}
                                        onClick={() => loadEmployees(group1.label, group2.label, Math.max(1, (employeeData?.page || 1) - 1))}
                                      >
                                        Prev
                                      </button>
                                      <span>Hal {(employeeData?.page || 1)} / {totalPages}</span>
                                      <button
                                        className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50"
                                        disabled={(employeeData?.page || 1) >= totalPages}
                                        onClick={() => loadEmployees(group1.label, group2.label, Math.min(totalPages, (employeeData?.page || 1) + 1))}
                                      >
                                        Next
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </>
                          ) : null}
                        </Fragment>
                      );
                    })
                    : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {!loadingTree && !tree.length ? <p className="px-4 py-8 text-center text-sm text-slate-500">Data drilldown tidak ditemukan.</p> : null}
      </div>
    </section>
  );
}

function UkpdDrillPanel({ query }) {
  const [loadingTree, setLoadingTree] = useState(false);
  const [tree, setTree] = useState([]);
  const [open1, setOpen1] = useState({});
  const [open2, setOpen2] = useState({});
  const [open3, setOpen3] = useState({});
  const [employeesByNode, setEmployeesByNode] = useState({});
  const [loadingNode, setLoadingNode] = useState("");
  const [pageByNode, setPageByNode] = useState({});
  const pageSize = 20;
  const getCount = (counts, key) => formatNumber(counts?.[key] || 0);
  const groupedTree = useMemo(() => {
    const groups = new Map();
    for (const ukpd of tree) {
      const wilayah = ukpd.wilayah || "Tidak Diketahui";
      if (!groups.has(wilayah)) groups.set(wilayah, []);
      groups.get(wilayah).push(ukpd);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "id"))
      .map(([wilayah, items]) => [
        wilayah,
        items.sort((a, b) => a.label.localeCompare(b.label, "id"))
      ]);
  }, [tree]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ mode: "ukpd" });
      if (query) params.set("q", query);
      setLoadingTree(true);
      fetch(`/api/dashboard/pivot-tree?${params.toString()}`)
        .then((res) => res.json())
        .then((payload) => {
          setTree(payload?.data?.tree || []);
          setOpen1({});
          setOpen2({});
          setOpen3({});
          setEmployeesByNode({});
          setPageByNode({});
        })
        .finally(() => setLoadingTree(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  async function loadEmployees(group1, group2, group3, page = 1) {
    const nodeKey = `${group1}::${group2}::${group3}`;
    setLoadingNode(nodeKey);
    const params = new URLSearchParams({ mode: "ukpd", group1, group2, group3, page: String(page), pageSize: String(pageSize) });
    if (query) params.set("q", query);
    try {
      const response = await fetch(`/api/dashboard/pivot-tree?${params.toString()}`);
      const payload = await response.json();
      setEmployeesByNode((current) => ({
        ...current,
        [nodeKey]: { items: payload?.data?.employees || [], total: payload?.data?.total || 0, page: payload?.data?.page || page }
      }));
      setPageByNode((current) => ({ ...current, [nodeKey]: page }));
    } finally {
      setLoadingNode("");
    }
  }

  return (
    <section className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <h3 className="text-sm font-semibold text-slate-900">Pivot Drilldown: UKPD -&gt; Rumpun -&gt; Jabatan -&gt; Pegawai</h3>
      {loadingTree ? <p className="mt-3 text-sm text-slate-500">Memuat struktur...</p> : null}
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-[1200px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="w-16 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">No</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Row Labels</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Total</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">PNS/CPNS</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">PPPK</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">PPPK Paruh Waktu</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">NON PNS</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">PJLP</th>
            </tr>
          </thead>
          <tbody>
            {groupedTree.map(([wilayah, items]) => (
              <Fragment key={wilayah}>
                <tr className="border-b border-slate-200 bg-dinkes-50">
                  <td className="px-3 py-2" />
                  <td colSpan={7} className="px-3 py-2 text-sm font-bold text-slate-900">
                    Wilayah {wilayah}
                  </td>
                </tr>
                {items.map((ukpd, index) => {
              const isOpen1 = Boolean(open1[ukpd.label]);
              return (
                <Fragment key={ukpd.label}>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <td className="px-3 py-2 text-center text-sm font-semibold text-slate-700">{index + 1}</td>
                    <td className="px-3 py-2">
                      <button className="flex items-center gap-1 text-left text-sm font-semibold text-slate-900" onClick={() => setOpen1((s) => ({ ...s, [ukpd.label]: !s[ukpd.label] }))}>
                        {isOpen1 ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span>{ukpd.label}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-semibold text-slate-900">{formatNumber(ukpd.total)}</td>
                    <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(ukpd.counts, "pnsCpns")}</td>
                    <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(ukpd.counts, "pppk")}</td>
                    <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(ukpd.counts, "pppkParuhWaktu")}</td>
                    <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(ukpd.counts, "nonPns")}</td>
                    <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(ukpd.counts, "pjlp")}</td>
                  </tr>
                  {isOpen1 ? ukpd.children.map((rumpun) => {
                    const key2 = `${ukpd.label}::${rumpun.label}`;
                    const isOpen2 = Boolean(open2[key2]);
                    return (
                      <Fragment key={key2}>
                        <tr className="border-b border-slate-100">
                          <td className="px-3 py-2" />
                          <td className="px-3 py-2">
                            <button className="ml-6 flex items-center gap-1 text-left text-sm font-medium text-slate-800" onClick={() => setOpen2((s) => ({ ...s, [key2]: !s[key2] }))}>
                              {isOpen2 ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <span>{rumpun.label}</span>
                            </button>
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-medium text-slate-900">{formatNumber(rumpun.total)}</td>
                          <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(rumpun.counts, "pnsCpns")}</td>
                          <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(rumpun.counts, "pppk")}</td>
                          <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(rumpun.counts, "pppkParuhWaktu")}</td>
                          <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(rumpun.counts, "nonPns")}</td>
                          <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(rumpun.counts, "pjlp")}</td>
                        </tr>
                        {isOpen2 ? rumpun.children.map((jabatan) => {
                          const key3 = `${ukpd.label}::${rumpun.label}::${jabatan.label}`;
                          const isOpen3 = Boolean(open3[key3]);
                          const employeeData = employeesByNode[key3];
                          const totalPages = Math.max(1, Math.ceil((employeeData?.total || 0) / pageSize));
                          return (
                            <Fragment key={key3}>
                              <tr className="border-b border-slate-100">
                                <td className="px-3 py-2" />
                                <td className="px-3 py-2">
                                  <button className="ml-12 flex items-center gap-1 text-left text-sm text-slate-700" onClick={async () => {
                                    const next = !open3[key3];
                                    setOpen3((s) => ({ ...s, [key3]: next }));
                                    if (next) await loadEmployees(ukpd.label, rumpun.label, jabatan.label, pageByNode[key3] || 1);
                                  }}>
                                    {isOpen3 ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    <span>{jabatan.label}</span>
                                  </button>
                                </td>
                                <td className="px-3 py-2 text-right text-sm font-medium text-slate-900">{formatNumber(jabatan.total)}</td>
                                <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(jabatan.counts, "pnsCpns")}</td>
                                <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(jabatan.counts, "pppk")}</td>
                                <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(jabatan.counts, "pppkParuhWaktu")}</td>
                                <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(jabatan.counts, "nonPns")}</td>
                                <td className="px-3 py-2 text-right text-sm text-slate-700">{getCount(jabatan.counts, "pjlp")}</td>
                              </tr>
                              {isOpen3 ? (
                                <>
                                  {(employeeData?.items || []).map((employee) => (
                                    <tr key={employee.id_pegawai} className="border-b border-slate-100 hover:bg-dinkes-50/40">
                                      <td className="px-3 py-1" />
                                      <td className="px-3 py-1 text-sm text-slate-700">
                                        <div className="ml-16 flex items-center justify-between gap-3">
                                          <span>{employee.nama}</span>
                                          <Link className="shrink-0 text-xs font-semibold text-dinkes-700 hover:text-dinkes-900" href={`/pegawai/${employee.id_pegawai}`} target="_blank" rel="noopener noreferrer">
                                            Lihat Profil
                                          </Link>
                                        </div>
                                      </td>
                                      <td className="px-3 py-1 text-right text-xs text-slate-400">-</td>
                                      <td className="px-3 py-1 text-right text-xs text-slate-400">-</td>
                                      <td className="px-3 py-1 text-right text-xs text-slate-400">-</td>
                                      <td className="px-3 py-1 text-right text-xs text-slate-400">-</td>
                                      <td className="px-3 py-1 text-right text-xs text-slate-400">-</td>
                                      <td className="px-3 py-1 text-right text-xs text-slate-400">-</td>
                                    </tr>
                                  ))}
                                  {loadingNode === key3 ? (
                                    <tr className="border-b border-slate-100">
                                      <td className="px-3 py-2 text-xs text-slate-500" colSpan={8}>
                                        <span className="ml-16">Memuat pegawai...</span>
                                      </td>
                                    </tr>
                                  ) : null}
                                  {(employeeData?.total || 0) > pageSize ? (
                                    <tr className="border-b border-slate-100">
                                      <td className="px-3 py-2" colSpan={8}>
                                        <div className="ml-16 flex items-center gap-2 text-xs text-slate-600">
                                          <button className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50" disabled={(employeeData?.page || 1) <= 1} onClick={() => loadEmployees(ukpd.label, rumpun.label, jabatan.label, Math.max(1, (employeeData?.page || 1) - 1))}>Prev</button>
                                          <span>Hal {(employeeData?.page || 1)} / {totalPages}</span>
                                          <button className="rounded border border-slate-200 px-2 py-1 disabled:opacity-50" disabled={(employeeData?.page || 1) >= totalPages} onClick={() => loadEmployees(ukpd.label, rumpun.label, jabatan.label, Math.min(totalPages, (employeeData?.page || 1) + 1))}>Next</button>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : null}
                                </>
                              ) : null}
                            </Fragment>
                          );
                        }) : null}
                      </Fragment>
                    );
                  }) : null}
                </Fragment>
              );
            })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DashboardAnalyticsPanel({ analytics }) {
  const [activeTab, setActiveTab] = useState("ukpd");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.toLowerCase();

  const rows = useMemo(() => {
    if (!analytics) return [];
    if (activeTab === "ukpd" || activeTab === "jenis-ukpd") {
      return analytics.ukpdSummary.filter((row) => [row.nama_ukpd, row.wilayah, row.jenis_ukpd].join(" ").toLowerCase().includes(normalizedQuery));
    }
    if (activeTab === "rumpun") {
      return analytics.rumpunByJenisPegawai.filter((row) => {
        const matchQuery = [row.jenis_pegawai, row.rumpun_jabatan].join(" ").toLowerCase().includes(normalizedQuery);
        return matchQuery;
      });
    }
    return analytics.jabatanMenpanByJenisPegawai.filter((row) => {
      const matchQuery = [row.jenis_pegawai, row.jabatan_kepmenpan_11].join(" ").toLowerCase().includes(normalizedQuery);
      return matchQuery;
    });
  }, [activeTab, analytics, normalizedQuery]);

  const limitedRows = rows.slice(0, activeTab === "kepmenpan" ? 500 : 200);
  const exportRows = useMemo(() => {
    if (activeTab === "ukpd" || activeTab === "jenis-ukpd") {
      const grouped = new Map();
      for (const row of rows) {
        const wilayah = row.wilayah || "Tidak Diketahui";
        if (!grouped.has(wilayah)) grouped.set(wilayah, []);
        grouped.get(wilayah).push(row);
      }
      const result = [];
      for (const [wilayah, items] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const sortedItems = items.sort((a, b) => a.nama_ukpd.localeCompare(b.nama_ukpd));
        sortedItems.forEach((item, index) => {
          const pnsCpns = (item.byJenisPegawai?.PNS || 0) + (item.byJenisPegawai?.CPNS || 0);
          result.push([
            wilayah,
            index + 1,
            item.nama_ukpd,
            item.total || 0,
            pnsCpns,
            item.byJenisPegawai?.PPPK || 0,
            item.byJenisPegawai?.["PPPK Paruh Waktu"] || 0,
            item.byJenisPegawai?.["NON PNS"] || 0,
            item.byJenisPegawai?.PJLP || 0
          ]);
        });
      }
      return {
        filename: "daftar-ukpd.csv",
        headers: ["Wilayah", "No", "Nama UKPD", "Total Pegawai", "PNS/CPNS", "PPPK", "PPPK Paruh Waktu", "NON PNS", "PJLP"],
        rows: result
      };
    }

    const isRumpun = activeTab === "rumpun";
    const aggregated = buildPivotAggregates(rows, isRumpun ? "rumpun_jabatan" : "jabatan_kepmenpan_11");
    return {
      filename: isRumpun ? "rumpun-jabatan.csv" : "jabatan-kepmenpan-11.csv",
      headers: ["No", isRumpun ? "Rumpun Jabatan" : "Jabatan Kepmenpan 11", "Total Pegawai", "PNS/CPNS", "PPPK", "PPPK Paruh Waktu", "NON PNS", "PJLP"],
      rows: aggregated.map((item, index) => [
        index + 1,
        item.label,
        item.total,
        item.pnsCpns,
        item.pppk,
        item.pppkParuhWaktu,
        item.nonPns,
        item.pjlp
      ])
    };
  }, [activeTab, rows]);
  const columnsByTab = {
    ukpd: [],
    "jenis-ukpd": [],
    rumpun: [
      { key: "jenis_pegawai", header: "Jenis Pegawai", render: (row) => <StatusBadge status={row.jenis_pegawai} /> },
      { key: "rumpun_jabatan", header: "Rumpun Jabatan" },
      { key: "jumlah", header: "Jumlah", render: (row) => formatNumber(row.jumlah) }
    ],
    kepmenpan: [
      { key: "jenis_pegawai", header: "Jenis Pegawai", render: (row) => <StatusBadge status={row.jenis_pegawai} /> },
      { key: "jabatan_kepmenpan_11", header: "Jabatan Kepmenpan 11" },
      { key: "jumlah", header: "Jumlah", render: (row) => formatNumber(row.jumlah) }
    ]
  };

  return (
    <section className="mt-6">
      <nav className="flex gap-2 overflow-x-auto pb-3" aria-label="Menu analitik dashboard">
        {analyticsTabs.map((tab) => (
          <button
            key={tab.id}
            className={`inline-flex shrink-0 items-center rounded-t-xl border border-b-0 px-4 py-2 text-sm font-semibold transition focus-ring ${activeTab === tab.id ? "border-dinkes-700 bg-dinkes-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
            onClick={() => {
              setActiveTab(tab.id);
              setQuery("");
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="rounded-2xl rounded-tl-none border border-slate-200 bg-white p-4 shadow-soft">
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold text-slate-900">{activeTab === "ukpd" ? "Daftar UKPD (Aktif)" : activeTab === "rumpun" ? "Daftar Rumpun Jabatan" : "Daftar Jabatan Kepmenpan 11"}</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
          <button
            className="btn-secondary"
            onClick={() => downloadCsv(exportRows.filename, exportRows.headers, exportRows.rows)}
            type="button"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
          <label className="relative min-w-64">
            <span className="sr-only">Cari analitik</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input py-2 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={activeTab === "ukpd" || activeTab === "jenis-ukpd" ? "Cari UKPD/Wilayah..." : "Cari rumpun atau jabatan..."} />
          </label>
        </div>
      </header>

      <div>
        {activeTab === "ukpd" || activeTab === "jenis-ukpd" ? (
          <>
            <UkpdDrillPanel query={query} />
          </>
        ) : activeTab === "rumpun" ? (
          <PivotDrillPanel mode="rumpun" query={query} />
        ) : activeTab === "kepmenpan" ? (
          <PivotDrillPanel mode="jabatan" query={query} />        ) : (
          <AnalyticsTable columns={columnsByTab[activeTab]} rows={limitedRows} rowKey="label" />
        )}
      </div>
      <footer className="mt-3 text-sm text-slate-500">
        Menampilkan {formatNumber(limitedRows.length)} dari {formatNumber(rows.length)} baris. Gunakan pencarian untuk mempersempit daftar.
      </footer>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [chartView, setChartView] = useState("statusPegawai");

  useEffect(() => {
    fetch("/api/dashboard").then((res) => res.json()).then((payload) => setData(payload.data));
  }, []);

  if (!data) {
    return (
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl bg-white" />)}
      </section>
    );
  }

  const columns = [
    { key: "nama", header: "Nama" },
    { key: "nip", header: "NIP", render: (item) => item.nip || "-" },
    { key: "nama_jabatan_menpan", header: "Jabatan", render: (item) => item.nama_jabatan_menpan || item.nama_jabatan_orb || "-" },
    { key: "jenis_pegawai", header: "Status", render: (item) => <StatusBadge status={item.jenis_pegawai} /> },
    { key: "nama_ukpd", header: "UKPD" }
  ];
  const activeChartView = data.chartViews?.[chartView] || data.chartViews?.statusPegawai;
  const quickLinks = [
    { href: "/pegawai/new", label: "Tambah Pegawai", helper: "Input pegawai baru", icon: FilePlus2 },
    { href: "/pegawai", label: "Data Pegawai", helper: "Kelola profil dan riwayat", icon: UsersRound },
    { href: "/duk", label: "DUK", helper: "Pantau urutan kepangkatan", icon: BookUser },
    { href: "/profil", label: "Profil Akun", helper: "Lihat sesi aktif", icon: ShieldCheck }
  ];

  return (
    <>
      <PageHeader
        title={`Selamat datang, ${data.user.nama_ukpd || data.user.username}`}
        description={`Dashboard ${data.user.role} untuk ${data.user.wilayah || data.user.nama_ukpd}. Data Yang Ditampilkan Sesuai Session Login.`}
        action={<Link className="btn-primary" href="/pegawai/new"><FilePlus2 className="h-4 w-4" /> Tambah Pegawai</Link>}
      />

      <section className="surface relative overflow-hidden p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(13,148,136,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_28%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-dinkes-100 bg-dinkes-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-dinkes-700">
              Ringkasan Session
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-950">Monitoring SDM kesehatan dalam satu layar kerja.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Akses cepat untuk pengelolaan pegawai, DUK, dan analitik distribusi pegawai berdasarkan UKPD, rumpun, serta jabatan.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {quickLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="rounded-2xl border border-slate-200 bg-white/90 p-4 transition hover:-translate-y-0.5 hover:border-dinkes-200 hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-xl bg-dinkes-50 p-3 text-dinkes-700">
                        <Icon className="h-5 w-5" />
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.helper}</p>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cakupan Data</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{formatNumber(data.summary.total)}</p>
              <p className="mt-1 text-sm text-slate-500">Pegawai aktif di scope session ini.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unit Terpantau</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{formatNumber(data.analytics?.ukpdSummary?.length || 0)}</p>
              <p className="mt-1 text-sm text-slate-500">Jumlah UKPD yang muncul pada dashboard.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Komposisi ASN</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{formatNumber(data.summary.pnsCpns + data.summary.pppk + data.summary.pppkParuhWaktu)}</p>
              <p className="mt-1 text-sm text-slate-500">Gabungan PNS/CPNS dan PPPK.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard title="Total Pegawai" value={data.summary.total} helper="Jumlah Pegawai Seluruh UKPD" icon={UsersRound} />
        <KpiCard title="PNS/CPNS" value={data.summary.pnsCpns} helper="ASN aktif" icon={ShieldCheck} tone="green" />
        <KpiCard title="PPPK" value={data.summary.pppk} helper="Penuh waktu" icon={UserRoundCheck} tone="gold" />
        <KpiCard title="PPPK Paruh Waktu" value={data.summary.pppkParuhWaktu} helper="Paruh waktu" icon={UserRoundCheck} tone="gold" />
        <KpiCard title="NON PNS" value={data.summary.nonPns} helper="Pegawai Profesional" icon={BriefcaseMedical} tone="slate" />
        <KpiCard title="PJLP" value={data.summary.pjlp} helper="PJLP" icon={UsersRound} />
      </section>

      {activeChartView ? (
        <>
          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Visual Analitik</h2>
              <p className="text-sm text-slate-500">Ganti mode grafik untuk membaca distribusi pegawai dari perspektif yang berbeda.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.chartViews || {}).map(([key, view]) => (
                <button
                  key={key}
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${chartView === key ? "bg-dinkes-700 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                  onClick={() => setChartView(key)}
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>

          <section className="mt-3 grid gap-5 xl:grid-cols-2">
            <DashboardChartCard title={activeChartView.titles.distribution} type="doughnut" heightClass="h-80" {...activeChartView.distribution} />
            <DashboardChartCard title={activeChartView.titles.ukpd} stacked heightClass="h-80" {...activeChartView.ukpd} />
            <DashboardChartCard title={activeChartView.titles.pendidikan} horizontal stacked heightClass="h-80" {...activeChartView.pendidikan} />
            <DashboardChartCard title={activeChartView.titles.rumpun} stacked heightClass="h-80" {...activeChartView.rumpun} />
          </section>
        </>
      ) : null}

      <DashboardAnalyticsPanel analytics={data.analytics} />

      <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_360px]">
        <article>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Pegawai Terbaru</h2>
            <Link className="text-sm font-semibold text-dinkes-700 hover:text-dinkes-900" href="/pegawai">Lihat semua</Link>
          </div>
          <DataTable columns={columns} data={data.latestEmployees} rowKey="id_pegawai" />
        </article>
        <aside className="surface p-5">
          <h2 className="text-lg font-semibold text-slate-950">Ringkasan Usulan</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Usulan Mutasi</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{data.usulanSummary.mutasi}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Usulan Putus JF</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{data.usulanSummary.putusJf}</p>
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}
