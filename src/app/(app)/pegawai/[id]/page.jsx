import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Edit, Mail, MapPin, Phone } from "lucide-react";
import { filterPegawaiByRole, getPegawaiWilayah } from "@/lib/auth/access";
import { getCurrentUser } from "@/lib/auth/session";
import { getPegawaiById, getPegawaiDetailData, getUkpdData } from "@/lib/data/pegawaiStore";
import { getPegawaiPhotoUrl } from "@/lib/helpers/pegawaiPhoto";
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

function cleanNip(value) {
  return String(value || "").trim().replace(/^`+/, "");
}

export default async function DetailPegawaiPage({ params }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [pegawaiRow, ukpdList] = await Promise.all([
    getPegawaiById(params.id),
    getUkpdData()
  ]);

  const pegawai = pegawaiRow ? filterPegawaiByRole([pegawaiRow], user, ukpdList)[0] : null;
  if (!pegawai) {
    notFound();
  }

  const [detail, photoUrl] = await Promise.all([
    getPegawaiDetailData(params.id),
    getPegawaiPhotoUrl(params.id)
  ]);

  const alamat = detail.alamat || [];
  const alamatKtp = alamat.find((entry) => String(entry.tipe || "").toLowerCase() === "ktp");
  const alamatDomisili = alamat.find((entry) => String(entry.tipe || "").toLowerCase() === "domisili");
  const tempatTanggalLahir = [pegawai.tempat_lahir, formatDate(pegawai.tanggal_lahir)].filter(Boolean).join(" / ");
  const umur = durationFrom(pegawai.tanggal_lahir);
  const tmtKerja = `${formatDate(pegawai.tmt_kerja_ukpd)} - ${durationFrom(pegawai.tmt_kerja_ukpd)}`;
  const jabatan = pegawai.nama_jabatan_menpan || pegawai.nama_jabatan_orb || "-";
  const pegawaiDetail = {
    ...pegawai,
    ...detail,
    nip: cleanNip(pegawai.nip),
    wilayah: getPegawaiWilayah(pegawai, ukpdList),
    photo_url: photoUrl,
    alamat,
    alamat_ktp: alamatKtp?.alamat_lengkap || null,
    alamat_domisili: alamatDomisili?.alamat_lengkap || null
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-lg bg-slate-100 ring-1 ring-slate-200">
              <Image src={pegawaiDetail.photo_url || "/FOTO/OIP.JPG"} alt={`Foto ${pegawaiDetail.nama || "pegawai"}`} width={96} height={96} className="h-24 w-24 object-cover" priority unoptimized />
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-2">
                <StatusBadge status={pegawaiDetail.jenis_pegawai} />
                <StatusBadge status={pegawaiDetail.kondisi} />
              </div>
              <h1 className="break-words text-2xl font-extrabold tracking-normal text-slate-950">{fullNameWithTitle(pegawaiDetail)}</h1>
              <p className="mt-1 text-base font-medium text-slate-600">{jabatan}</p>
              <p className="mt-2 text-sm font-bold text-slate-900">Unit / UKPD: {valueOrDash(pegawaiDetail.nama_ukpd)}</p>
              <p className="mt-1 text-sm text-slate-600">Status Aktif: {valueOrDash(pegawaiDetail.kondisi)}</p>
            </div>
          </div>
          <Link className="btn-primary self-start" href={`/pegawai/${pegawaiDetail.id_pegawai}/edit`}>
            <Edit className="h-4 w-4" />
            Edit Profil
          </Link>
        </div>
      </section>

      <ProfileSection title="Identitas" items={[
        { label: "NIP", value: pegawaiDetail.nip },
        { label: "Nama Lengkap", value: fullNameWithTitle(pegawaiDetail) },
        { label: "Jenis Kelamin", value: pegawaiDetail.jenis_kelamin },
        { label: "Tempat / Tanggal Lahir", value: tempatTanggalLahir },
        { label: "Umur", value: umur },
        { label: "Agama", value: pegawaiDetail.agama },
        { label: "Status Pernikahan", value: pegawaiDetail.status_perkawinan },
        { label: "Golongan Darah", value: pegawaiDetail.golongan_darah },
        { label: "NPWP", value: pegawaiDetail.npwp },
        { label: "No BPJS", value: pegawaiDetail.no_bpjs }
      ]} />

      <ProfileSection title="Kepegawaian" items={[
        { label: "Jenis Pegawai", value: pegawaiDetail.jenis_pegawai },
        { label: "Status Aktif", value: pegawaiDetail.kondisi },
        { label: "Status Rumpun", value: pegawaiDetail.status_rumpun },
        { label: "Jenis Kontrak", value: pegawaiDetail.jenis_kontrak },
        { label: "Jabatan Pergub", value: pegawaiDetail.nama_jabatan_orb },
        { label: "Jabatan Kepmenpan", value: pegawaiDetail.nama_jabatan_menpan },
        { label: "TMT Kerja UKPD", value: tmtKerja },
        { label: "UKPD", value: pegawaiDetail.nama_ukpd },
        { label: "Wilayah", value: pegawaiDetail.wilayah },
        { label: "Pangkat / Golongan", value: pegawaiDetail.pangkat_golongan },
        { label: "TMT Pangkat", value: formatDate(pegawaiDetail.tmt_pangkat_terakhir) }
      ]} />

      <ProfileSection title="Pendidikan & Gelar" items={[
        { label: "Jenjang Pendidikan", value: pegawaiDetail.jenjang_pendidikan },
        { label: "Jurusan Pendidikan", value: pegawaiDetail.program_studi },
        { label: "Universitas", value: pegawaiDetail.nama_universitas },
        { label: "Gelar Depan", value: pegawaiDetail.gelar_depan },
        { label: "Gelar Belakang", value: pegawaiDetail.gelar_belakang }
      ]} />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-950">Kontak & Alamat</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-4">
          <InfoField label="Email" value={pegawaiDetail.email} />
          <InfoField label="Telepon" value={pegawaiDetail.no_hp_pegawai} />
          <InfoField label="Alamat KTP" value={pegawaiDetail.alamat_ktp || pegawaiDetail.alamat || "-"} />
          <InfoField label="Alamat Domisili" value={pegawaiDetail.alamat_domisili || pegawaiDetail.alamat || "-"} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
          <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-teal-700" />{valueOrDash(pegawaiDetail.email)}</span>
          <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-teal-700" />{valueOrDash(pegawaiDetail.no_hp_pegawai)}</span>
          <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-teal-700" />{valueOrDash(pegawaiDetail.wilayah)}</span>
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
          ...(pegawaiDetail.pasangan || []).map((item) => ({
            ...item,
            jenis: "Pasangan",
            jenis_kelamin: "-"
          })),
          ...(pegawaiDetail.anak || []).map((item) => ({
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
        rows={pegawaiDetail.riwayat_jabatan || []}
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
        rows={pegawaiDetail.riwayat_pangkat || []}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-950">Catatan</h2>
        <div className="mt-3 min-h-16 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">-</div>
      </section>
    </div>
  );
}
