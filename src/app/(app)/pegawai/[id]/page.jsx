"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Edit, Mail, MapPin, Phone } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";

function valueOrDash(value) {
  return value || "-";
}

function fullNameWithTitle(pegawai) {
  return [pegawai.gelar_depan, pegawai.nama, pegawai.gelar_belakang].filter(Boolean).join(" ");
}

function parseDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(`${text}T00:00:00`);
  const slash = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) return new Date(Number(slash[3]), Number(slash[2]) - 1, Number(slash[1]));
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return valueOrDash(value);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "numeric", year: "numeric" }).format(date);
}

function durationFrom(value) {
  const date = parseDate(value);
  if (!date) return "-";
  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  let months = now.getMonth() - date.getMonth();
  if (now.getDate() < date.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years <= 0) return `${months} bulan`;
  return `${years} tahun ${months} bulan`;
}

function InfoField({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <dt className="text-xs font-bold text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium leading-5 text-slate-900">{valueOrDash(value)}</dd>
    </div>
  );
}

function ProfileSection({ title, items }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-extrabold text-slate-950">{title}</h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {items.map((item) => (
          <InfoField key={item.label} label={item.label} value={item.value} />
        ))}
      </dl>
    </section>
  );
}

function ListSection({ title, columns, rows, emptyText = "-" }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-extrabold text-slate-950">{title}</h2>
      {!rows?.length ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{emptyText}</div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr key={row.id || `${title}-${index}`}>
                  {columns.map((column) => (
                    <td key={column.key} className="px-3 py-2 text-sm text-slate-700">
                      {column.render ? column.render(row, index) : valueOrDash(row[column.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function DetailPegawaiPage({ params }) {
  const [pegawai, setPegawai] = useState(null);

  useEffect(() => {
    fetch(`/api/pegawai/${params.id}`).then((res) => res.json()).then((payload) => setPegawai(payload.data));
  }, [params.id]);

  const computed = useMemo(() => {
    if (!pegawai) return null;
    return {
      tempatTanggalLahir: [pegawai.tempat_lahir, formatDate(pegawai.tanggal_lahir)].filter(Boolean).join(" / "),
      umur: durationFrom(pegawai.tanggal_lahir),
      tmtKerja: `${formatDate(pegawai.tmt_kerja_ukpd)} - ${durationFrom(pegawai.tmt_kerja_ukpd)}`,
      jabatan: pegawai.nama_jabatan_menpan || pegawai.nama_jabatan_orb || "-"
    };
  }, [pegawai]);

  if (!pegawai || !computed) return <div className="h-64 animate-pulse rounded-2xl bg-white" />;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-lg bg-slate-100 ring-1 ring-slate-200">
              <Image src={pegawai.photo_url || "/FOTO/OIP.JPG"} alt={`Foto ${pegawai.nama || "pegawai"}`} width={96} height={96} className="h-24 w-24 object-cover" priority unoptimized />
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-2">
                <StatusBadge status={pegawai.jenis_pegawai} />
                <StatusBadge status={pegawai.kondisi} />
              </div>
              <h1 className="break-words text-2xl font-extrabold tracking-normal text-slate-950">{fullNameWithTitle(pegawai)}</h1>
              <p className="mt-1 text-base font-medium text-slate-600">{computed.jabatan}</p>
              <p className="mt-2 text-sm font-bold text-slate-900">Unit / UKPD: {valueOrDash(pegawai.nama_ukpd)}</p>
              <p className="mt-1 text-sm text-slate-600">Status Aktif: {valueOrDash(pegawai.kondisi)}</p>
            </div>
          </div>
          <Link className="btn-primary self-start" href={`/pegawai/${pegawai.id_pegawai}/edit`}>
            <Edit className="h-4 w-4" />
            Edit Profil
          </Link>
        </div>
      </section>

      <ProfileSection title="Identitas" items={[
        { label: "NIP", value: pegawai.nip },
        { label: "Nama Lengkap", value: fullNameWithTitle(pegawai) },
        { label: "Jenis Kelamin", value: pegawai.jenis_kelamin },
        { label: "Tempat / Tanggal Lahir", value: computed.tempatTanggalLahir },
        { label: "Umur", value: computed.umur },
        { label: "Agama", value: pegawai.agama },
        { label: "Status Pernikahan", value: pegawai.status_perkawinan },
        { label: "Golongan Darah", value: pegawai.golongan_darah },
        { label: "NPWP", value: pegawai.npwp },
        { label: "No BPJS", value: pegawai.no_bpjs }
      ]} />

      <ProfileSection title="Kepegawaian" items={[
        { label: "Jenis Pegawai", value: pegawai.jenis_pegawai },
        { label: "Status Aktif", value: pegawai.kondisi },
        { label: "Status Rumpun", value: pegawai.status_rumpun },
        { label: "Jenis Kontrak", value: pegawai.jenis_kontrak },
        { label: "Jabatan Pergub", value: pegawai.nama_jabatan_orb },
        { label: "Jabatan Kepmenpan", value: pegawai.nama_jabatan_menpan },
        { label: "TMT Kerja UKPD", value: computed.tmtKerja },
        { label: "UKPD", value: pegawai.nama_ukpd },
        { label: "Wilayah", value: pegawai.wilayah },
        { label: "Pangkat / Golongan", value: pegawai.pangkat_golongan },
        { label: "TMT Pangkat", value: formatDate(pegawai.tmt_pangkat_terakhir) }
      ]} />

      <ProfileSection title="Pendidikan & Gelar" items={[
        { label: "Jenjang Pendidikan", value: pegawai.jenjang_pendidikan },
        { label: "Jurusan Pendidikan", value: pegawai.program_studi },
        { label: "Universitas", value: pegawai.nama_universitas },
        { label: "Gelar Depan", value: pegawai.gelar_depan },
        { label: "Gelar Belakang", value: pegawai.gelar_belakang }
      ]} />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-950">Kontak & Alamat</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-4">
          <InfoField label="Email" value={pegawai.email} />
          <InfoField label="Telepon" value={pegawai.no_hp_pegawai} />
          <InfoField label="Alamat KTP" value={pegawai.alamat_ktp || pegawai.alamat || "-"} />
          <InfoField label="Alamat Domisili" value={pegawai.alamat_domisili || pegawai.alamat || "-"} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
          <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-teal-700" />{valueOrDash(pegawai.email)}</span>
          <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-teal-700" />{valueOrDash(pegawai.no_hp_pegawai)}</span>
          <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-teal-700" />{valueOrDash(pegawai.wilayah)}</span>
        </div>
      </section>

      <ListSection
        title="Keluarga"
        emptyText="Data keluarga belum tersedia."
        columns={[
          { key: "jenis", label: "Jenis" },
          { key: "nama", label: "Nama" },
          { key: "jenis_kelamin", label: "Jenis Kelamin" },
          { key: "tanggal_lahir", label: "Tanggal Lahir", render: (row) => formatDate(row.tanggal_lahir) },
          { key: "pekerjaan", label: "Pekerjaan" }
        ]}
        rows={[
          ...(pegawai.pasangan || []).map((item) => ({
            ...item,
            jenis: "Pasangan",
            jenis_kelamin: "-"
          })),
          ...(pegawai.anak || []).map((item) => ({
            ...item,
            jenis: `Anak ${item.urutan || ""}`.trim()
          }))
        ]}
      />

      <ListSection
        title="Riwayat Jabatan"
        emptyText="Riwayat jabatan belum tersedia."
        columns={[
          { key: "nama_jabatan_menpan", label: "Jabatan", render: (row) => row.nama_jabatan_menpan || row.nama_jabatan_orb || "-" },
          { key: "struktur_atasan_langsung", label: "Atasan" },
          { key: "tmt_jabatan", label: "TMT", render: (row) => formatDate(row.tmt_jabatan) },
          { key: "nomor_sk", label: "Nomor SK" },
          { key: "keterangan", label: "Keterangan" }
        ]}
        rows={pegawai.riwayat_jabatan || []}
      />

      <ListSection
        title="Riwayat Pangkat"
        emptyText="Riwayat pangkat belum tersedia."
        columns={[
          { key: "pangkat_golongan", label: "Pangkat/Golongan" },
          { key: "tmt_pangkat", label: "TMT", render: (row) => formatDate(row.tmt_pangkat) },
          { key: "nomor_sk", label: "Nomor SK" },
          { key: "keterangan", label: "Keterangan" }
        ]}
        rows={pegawai.riwayat_pangkat || []}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-950">Catatan</h2>
        <div className="mt-3 min-h-16 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">-</div>
      </section>
    </div>
  );
}
