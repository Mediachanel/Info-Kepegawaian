"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ROLES } from "@/lib/constants/roles";
import { JENIS_PEGAWAI_OPTIONS } from "@/lib/helpers/pegawaiStatus";

const AGAMA_OPTIONS = ["ISLAM", "KRISTEN PROTESTAN", "KATOLIK", "HINDU", "BUDDHA", "KONGHUCU"];
const JENIS_KELAMIN_OPTIONS = ["Perempuan", "Laki-laki"];
const KONDISI_OPTIONS = ["AKTIF", "CUTI", "TUBEL", "TIDAK AKTIF", "PENSIUN"];
const STATUS_PERKAWINAN_OPTIONS = ["BELUM KAWIN", "MENIKAH", "KAWIN", "KAWIN 1 ISTRI/SUAMI", "CERAI HIDUP", "CERAI MATI", "DUDA", "JANDA"];
const JENJANG_OPTIONS = ["SMA/SMK", "SMA", "SMK", "D3", "D4", "S1", "S2", "S3", "Profesi", "Spesialis"];
const JENIS_KONTRAK_FALLBACK = ["TETAP", "KONTRAK", "FULL TIME TETAP", "PPPK", "PPPK PARUH WAKTU"];

const defaultAddress = {
  jalan: "",
  kelurahan: "",
  kecamatan: "",
  kota_kabupaten: "",
  provinsi: "",
  kode_provinsi: "",
  kode_kota_kab: "",
  kode_kecamatan: "",
  kode_kelurahan: ""
};

const defaultPasangan = {
  status_punya: "Tidak",
  nama: "",
  no_tlp: "",
  email: "",
  pekerjaan: ""
};

const defaultAnak = {
  nama: "",
  jenis_kelamin: "Perempuan",
  tempat_lahir: "",
  tanggal_lahir: "",
  pekerjaan: ""
};

const defaultRiwayatJabatan = {
  nama_jabatan_orb: "",
  nama_jabatan_menpan: "",
  struktur_atasan_langsung: "",
  status_rumpun: "",
  tmt_jabatan: "",
  nomor_sk: "",
  tanggal_sk: "",
  keterangan: ""
};

const defaultRiwayatPangkat = {
  pangkat_golongan: "",
  tmt_pangkat: "",
  nomor_sk: "",
  tanggal_sk: "",
  keterangan: ""
};

const defaultPegawai = {
  nama: "",
  jenis_kelamin: "Perempuan",
  tempat_lahir: "",
  tanggal_lahir: "",
  nik: "",
  agama: "ISLAM",
  nama_ukpd: "",
  jenis_pegawai: "PNS",
  status_rumpun: "",
  jenis_kontrak: "",
  nrk: "",
  nip: "",
  nama_jabatan_orb: "",
  nama_jabatan_menpan: "",
  struktur_atasan_langsung: "",
  pangkat_golongan: "",
  tmt_pangkat_terakhir: "",
  jenjang_pendidikan: "",
  program_studi: "",
  nama_universitas: "",
  no_hp_pegawai: "",
  email: "",
  no_bpjs: "",
  kondisi: "AKTIF",
  status_perkawinan: "BELUM KAWIN",
  gelar_depan: "",
  gelar_belakang: "",
  tmt_kerja_ukpd: "",
  photo_url: "/FOTO/OIP.JPG",
  photo_upload: null,
  alamat_ktp: { ...defaultAddress },
  alamat_domisili: { ...defaultAddress },
  pasangan: [{ ...defaultPasangan }],
  anak: [{ ...defaultAnak }],
  riwayat_jabatan: [{ ...defaultRiwayatJabatan }],
  riwayat_pangkat: [{ ...defaultRiwayatPangkat }]
};

const sections = [
  { title: "Identitas Pribadi", fields: ["nama", "gelar_depan", "gelar_belakang", "jenis_kelamin", "tempat_lahir", "tanggal_lahir", "nik", "agama"] },
  { title: "Data Kepegawaian", fields: ["nama_ukpd", "jenis_pegawai", "status_rumpun", "jenis_kontrak", "nrk", "nip", "kondisi", "tmt_kerja_ukpd"] },
  { title: "Jabatan dan Pangkat Saat Ini", fields: ["nama_jabatan_orb", "nama_jabatan_menpan", "struktur_atasan_langsung", "pangkat_golongan", "tmt_pangkat_terakhir"] },
  { title: "Pendidikan dan Kontak", fields: ["jenjang_pendidikan", "program_studi", "nama_universitas", "no_hp_pegawai", "email", "no_bpjs", "status_perkawinan"] }
];

const labels = {
  nama: "Nama Lengkap",
  jenis_kelamin: "Jenis Kelamin",
  tempat_lahir: "Tempat Lahir",
  tanggal_lahir: "Tanggal Lahir",
  nik: "NIK",
  agama: "Agama",
  nama_ukpd: "Nama UKPD",
  jenis_pegawai: "Jenis Pegawai",
  status_rumpun: "Rumpun Jabatan",
  jenis_kontrak: "Jenis Kontrak",
  nrk: "NRK",
  nip: "NIP",
  nama_jabatan_orb: "Jabatan ORB",
  nama_jabatan_menpan: "Jabatan Kepmenpan 11",
  struktur_atasan_langsung: "Atasan Langsung",
  pangkat_golongan: "Pangkat/Golongan",
  tmt_pangkat_terakhir: "TMT Pangkat Saat Ini",
  jenjang_pendidikan: "Jenjang Pendidikan",
  program_studi: "Program Studi",
  nama_universitas: "Universitas",
  no_hp_pegawai: "No HP",
  email: "Email",
  no_bpjs: "No BPJS",
  kondisi: "Kondisi",
  status_perkawinan: "Status Perkawinan",
  gelar_depan: "Gelar Depan",
  gelar_belakang: "Gelar Belakang",
  tmt_kerja_ukpd: "TMT Kerja UKPD"
};

function normalizeText(value) {
  return String(value || "").trim();
}

function firstByType(alamat = [], tipe) {
  return alamat.find((item) => normalizeText(item?.tipe).toLowerCase() === tipe) || null;
}

function buildInitialForm(initialData) {
  const alamatKtp = firstByType(initialData?.alamat, "ktp");
  const alamatDomisili = firstByType(initialData?.alamat, "domisili");

  return {
    ...defaultPegawai,
    ...initialData,
    photo_url: initialData?.photo_url || "/FOTO/OIP.JPG",
    photo_upload: null,
    alamat_ktp: { ...defaultAddress, ...(alamatKtp || {}) },
    alamat_domisili: { ...defaultAddress, ...(alamatDomisili || {}) },
    pasangan: initialData?.pasangan?.length ? initialData.pasangan.map((item) => ({ ...defaultPasangan, ...item })) : [{ ...defaultPasangan }],
    anak: initialData?.anak?.length ? initialData.anak.map((item) => ({ ...defaultAnak, ...item })) : [{ ...defaultAnak }],
    riwayat_jabatan: initialData?.riwayat_jabatan?.length ? initialData.riwayat_jabatan.map((item) => ({ ...defaultRiwayatJabatan, ...item })) : [{ ...defaultRiwayatJabatan }],
    riwayat_pangkat: initialData?.riwayat_pangkat?.length ? initialData.riwayat_pangkat.map((item) => ({ ...defaultRiwayatPangkat, ...item })) : [{ ...defaultRiwayatPangkat }]
  };
}

function mergeOptions(...groups) {
  return [...new Set(groups.flat().map((item) => normalizeText(item)).filter(Boolean))];
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Gagal membaca file foto."));
    reader.readAsDataURL(file);
  });
}

function SectionCard({ title, children, description }) {
  return (
    <section className="surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FieldRenderer({ config, value, onChange, datalistOptions = [], disabled = false }) {
  const { name, type = "text", options = [], required = false, readOnly = false } = config;
  const inputType = type === "date" ? "date" : type === "email" ? "email" : "text";
  const datalistId = config.listId || `list-${name}`;

  return (
    <label className="space-y-2">
      <span className="label">{labels[name] || config.label}</span>
      {type === "select" ? (
        <select className="input" value={value || ""} onChange={(event) => onChange(event.target.value)} required={required} disabled={disabled}>
          {!required ? <option value="">Pilih {labels[name]?.toLowerCase() || "opsi"}</option> : null}
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : type === "datalist" ? (
        <>
          <input className="input" list={datalistId} type={inputType} value={value || ""} onChange={(event) => onChange(event.target.value)} required={required} disabled={disabled} readOnly={readOnly} />
          <datalist id={datalistId}>
            {datalistOptions.map((option) => <option key={option} value={option} />)}
          </datalist>
        </>
      ) : (
        <input className="input" type={inputType} value={value || ""} onChange={(event) => onChange(event.target.value)} required={required} disabled={disabled} readOnly={readOnly} />
      )}
    </label>
  );
}

export default function PegawaiForm({ initialData, mode = "create" }) {
  const router = useRouter();
  const [form, setForm] = useState(buildInitialForm(initialData));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState({ user: null, options: {} });
  const [loadingMeta, setLoadingMeta] = useState(true);

  useEffect(() => {
    setForm(buildInitialForm(initialData));
  }, [initialData]);

  useEffect(() => {
    let ignore = false;
    fetch("/api/pegawai/meta")
      .then((res) => res.json())
      .then((payload) => {
        if (!ignore) {
          setMeta(payload.data || { user: null, options: {} });
        }
      })
      .finally(() => {
        if (!ignore) setLoadingMeta(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!meta.user) return;
    if (mode === "create" && !form.nama_ukpd) {
      if (meta.user.role === ROLES.ADMIN_UKPD) {
        setForm((current) => ({ ...current, nama_ukpd: meta.user.nama_ukpd || "" }));
      } else if (meta.options?.ukpd?.length === 1) {
        setForm((current) => ({ ...current, nama_ukpd: meta.options.ukpd[0] || "" }));
      }
    }
  }, [meta, mode, form.nama_ukpd]);

  const optionMap = useMemo(() => ({
    agama: mergeOptions(AGAMA_OPTIONS, meta.options?.agama || []),
    jenis_kelamin: mergeOptions(JENIS_KELAMIN_OPTIONS, meta.options?.jenis_kelamin || []),
    jenis_pegawai: mergeOptions(JENIS_PEGAWAI_OPTIONS, meta.options?.jenis_pegawai || []),
    jenis_kontrak: mergeOptions(JENIS_KONTRAK_FALLBACK, meta.options?.jenis_kontrak || []),
    kondisi: KONDISI_OPTIONS,
    status_perkawinan: STATUS_PERKAWINAN_OPTIONS,
    jenjang_pendidikan: mergeOptions(JENJANG_OPTIONS, meta.options?.jenjang_pendidikan || []),
    nama_ukpd: meta.options?.ukpd || [],
    status_rumpun: meta.options?.rumpun || [],
    pangkat_golongan: meta.options?.pangkat_golongan || [],
    nama_jabatan_orb: meta.options?.jabatan_orb || [],
    nama_jabatan_menpan: meta.options?.jabatan_menpan || []
  }), [meta]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Format foto harus JPG, PNG, atau WEBP.");
      return;
    }
    if (file.size > 700 * 1024) {
      setMessage("Ukuran foto maksimal 700 KB.");
      return;
    }

    const dataUrl = await fileToDataUrl(file);
    setForm((current) => ({
      ...current,
      photo_url: dataUrl,
      photo_upload: {
        name: file.name,
        type: file.type,
        dataUrl
      }
    }));
    setMessage("");
  }

  function updateNestedObject(sectionName, name, value) {
    setForm((current) => ({
      ...current,
      [sectionName]: {
        ...current[sectionName],
        [name]: value
      }
    }));
  }

  function updateArrayItem(sectionName, index, name, value) {
    setForm((current) => ({
      ...current,
      [sectionName]: current[sectionName].map((item, itemIndex) => (itemIndex === index ? { ...item, [name]: value } : item))
    }));
  }

  function addArrayItem(sectionName, template) {
    setForm((current) => ({
      ...current,
      [sectionName]: [...current[sectionName], { ...template }]
    }));
  }

  function removeArrayItem(sectionName, index, template) {
    setForm((current) => {
      const nextItems = current[sectionName].filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        [sectionName]: nextItems.length ? nextItems : [{ ...template }]
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const endpoint = mode === "edit" ? `/api/pegawai/${form.id_pegawai}` : "/api/pegawai";
    const response = await fetch(endpoint, {
      method: mode === "edit" ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const payload = await response.json();
    setSaving(false);
    if (!payload.success) {
      setMessage(payload.message || "Gagal menyimpan data pegawai.");
      return;
    }
    router.push(`/pegawai/${payload.data.id_pegawai}`);
    router.refresh();
  }

  function fieldConfig(name) {
    if (name === "nama_ukpd") {
      const isLockedUkpd = meta.user?.role === ROLES.ADMIN_UKPD;
      return {
        name,
        type: isLockedUkpd || !optionMap.nama_ukpd.length ? "text" : "select",
        options: optionMap.nama_ukpd,
        required: true,
        readOnly: isLockedUkpd
      };
    }
    if (["agama", "jenis_kelamin", "jenis_pegawai", "jenis_kontrak", "kondisi", "status_perkawinan", "jenjang_pendidikan"].includes(name)) {
      return { name, type: "select", options: optionMap[name] || [], required: ["jenis_pegawai"].includes(name) };
    }
    if (["status_rumpun", "pangkat_golongan", "nama_jabatan_orb", "nama_jabatan_menpan"].includes(name)) {
      return { name, type: "datalist", required: false };
    }
    return {
      name,
      type: name.includes("tanggal") || name.startsWith("tmt") ? "date" : name === "email" ? "email" : "text",
      required: ["nama", "nama_ukpd", "jenis_pegawai"].includes(name)
    };
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {message ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{message}</p> : null}
      {loadingMeta ? <div className="h-20 animate-pulse rounded-2xl bg-white" /> : null}

      <SectionCard title="Foto Pegawai" description="Upload foto profil pegawai. File akan disimpan ke folder FOTO aplikasi.">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="h-36 w-36 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <img src={form.photo_url || "/FOTO/OIP.JPG"} alt="Foto pegawai" className="h-full w-full object-cover" />
          </div>
          <div className="flex-1 space-y-3">
            <label className="space-y-2">
              <span className="label">Upload Foto</span>
              <input className="input file:mr-3 file:rounded-lg file:border-0 file:bg-dinkes-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white" type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handlePhotoChange} />
            </label>
            <p className="text-sm text-slate-500">Gunakan foto formal. Format yang didukung: JPG, PNG, WEBP. Maksimal 700 KB.</p>
          </div>
        </div>
      </SectionCard>

      {sections.map((section) => (
        <SectionCard key={section.title} title={section.title}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {section.fields.map((field) => {
              const config = fieldConfig(field);
              return (
                <FieldRenderer
                  key={field}
                  config={config}
                  value={form[field]}
                  onChange={(value) => updateField(field, value)}
                  datalistOptions={optionMap[field] || []}
                  disabled={config.readOnly}
                />
              );
            })}
          </div>
        </SectionCard>
      ))}

      <SectionCard title="Alamat" description="Kelola alamat KTP dan alamat domisili pegawai.">
        <div className="grid gap-4 xl:grid-cols-2">
          {[
            { key: "alamat_ktp", title: "Alamat KTP" },
            { key: "alamat_domisili", title: "Alamat Domisili" }
          ].map((block) => (
            <div key={block.key} className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{block.title}</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {[
                  ["jalan", "Jalan / Detail Alamat"],
                  ["kelurahan", "Kelurahan"],
                  ["kecamatan", "Kecamatan"],
                  ["kota_kabupaten", "Kota/Kabupaten"],
                  ["provinsi", "Provinsi"],
                  ["kode_kelurahan", "Kode Kelurahan"],
                  ["kode_kecamatan", "Kode Kecamatan"],
                  ["kode_kota_kab", "Kode Kota/Kabupaten"],
                  ["kode_provinsi", "Kode Provinsi"]
                ].map(([name, label]) => (
                  <label key={name} className="space-y-2">
                    <span className="label">{label}</span>
                    <input className="input" value={form[block.key][name] || ""} onChange={(event) => updateNestedObject(block.key, name, event.target.value)} />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Keluarga" description="Kelola pasangan dan data anak pegawai.">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Pasangan</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="space-y-2">
                <span className="label">Status Punya Pasangan</span>
                <select className="input" value={form.pasangan[0]?.status_punya || "Tidak"} onChange={(event) => updateArrayItem("pasangan", 0, "status_punya", event.target.value)}>
                  {["Tidak", "Ya"].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              {[
                ["nama", "Nama Pasangan"],
                ["no_tlp", "No Telepon"],
                ["email", "Email"],
                ["pekerjaan", "Pekerjaan"]
              ].map(([name, label]) => (
                <label key={name} className="space-y-2">
                  <span className="label">{label}</span>
                  <input className="input" type={name === "email" ? "email" : "text"} value={form.pasangan[0]?.[name] || ""} onChange={(event) => updateArrayItem("pasangan", 0, name, event.target.value)} />
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">Anak</h3>
              <button type="button" className="btn-secondary py-2" onClick={() => addArrayItem("anak", defaultAnak)}>
                <Plus className="h-4 w-4" />
                Tambah Anak
              </button>
            </div>
            {form.anak.map((item, index) => (
              <div key={`anak-${index}`} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-slate-900">Anak {index + 1}</h4>
                  <button type="button" className="btn-secondary py-2 text-rose-600" onClick={() => removeArrayItem("anak", index, defaultAnak)}>
                    <Trash2 className="h-4 w-4" />
                    Hapus
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {[
                    ["nama", "Nama"],
                    ["tempat_lahir", "Tempat Lahir"],
                    ["tanggal_lahir", "Tanggal Lahir", "date"],
                    ["pekerjaan", "Pekerjaan"]
                  ].map(([name, label, type]) => (
                    <label key={name} className="space-y-2">
                      <span className="label">{label}</span>
                      <input className="input" type={type || "text"} value={item[name] || ""} onChange={(event) => updateArrayItem("anak", index, name, event.target.value)} />
                    </label>
                  ))}
                  <label className="space-y-2">
                    <span className="label">Jenis Kelamin</span>
                    <select className="input" value={item.jenis_kelamin || "Perempuan"} onChange={(event) => updateArrayItem("anak", index, "jenis_kelamin", event.target.value)}>
                      {optionMap.jenis_kelamin.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Riwayat Jabatan" description="Data ini dipakai saat lihat profil dan edit riwayat jabatan pegawai.">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500">Tambahkan jabatan terdahulu atau koreksi riwayat yang ada.</span>
            <button type="button" className="btn-secondary py-2" onClick={() => addArrayItem("riwayat_jabatan", { ...defaultRiwayatJabatan, status_rumpun: form.status_rumpun || "" })}>
              <Plus className="h-4 w-4" />
              Tambah Riwayat Jabatan
            </button>
          </div>
          {form.riwayat_jabatan.map((item, index) => (
            <div key={`riwayat-jabatan-${index}`} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-900">Riwayat Jabatan {index + 1}</h4>
                <button type="button" className="btn-secondary py-2 text-rose-600" onClick={() => removeArrayItem("riwayat_jabatan", index, defaultRiwayatJabatan)}>
                  <Trash2 className="h-4 w-4" />
                  Hapus
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <FieldRenderer config={{ name: "nama_jabatan_orb", type: "datalist", listId: `list-nama_jabatan_orb-${index}` }} value={item.nama_jabatan_orb} onChange={(value) => updateArrayItem("riwayat_jabatan", index, "nama_jabatan_orb", value)} datalistOptions={optionMap.nama_jabatan_orb} />
                <FieldRenderer config={{ name: "nama_jabatan_menpan", type: "datalist", listId: `list-nama_jabatan_menpan-${index}` }} value={item.nama_jabatan_menpan} onChange={(value) => updateArrayItem("riwayat_jabatan", index, "nama_jabatan_menpan", value)} datalistOptions={optionMap.nama_jabatan_menpan} />
                <label className="space-y-2">
                  <span className="label">Atasan Langsung</span>
                  <input className="input" value={item.struktur_atasan_langsung || ""} onChange={(event) => updateArrayItem("riwayat_jabatan", index, "struktur_atasan_langsung", event.target.value)} />
                </label>
                <FieldRenderer config={{ name: "status_rumpun", type: "datalist", listId: `list-status_rumpun-${index}` }} value={item.status_rumpun} onChange={(value) => updateArrayItem("riwayat_jabatan", index, "status_rumpun", value)} datalistOptions={optionMap.status_rumpun} />
                <label className="space-y-2">
                  <span className="label">TMT Jabatan</span>
                  <input className="input" type="date" value={item.tmt_jabatan || ""} onChange={(event) => updateArrayItem("riwayat_jabatan", index, "tmt_jabatan", event.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="label">Nomor SK</span>
                  <input className="input" value={item.nomor_sk || ""} onChange={(event) => updateArrayItem("riwayat_jabatan", index, "nomor_sk", event.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="label">Tanggal SK</span>
                  <input className="input" type="date" value={item.tanggal_sk || ""} onChange={(event) => updateArrayItem("riwayat_jabatan", index, "tanggal_sk", event.target.value)} />
                </label>
                <label className="space-y-2 xl:col-span-1">
                  <span className="label">Keterangan</span>
                  <input className="input" value={item.keterangan || ""} onChange={(event) => updateArrayItem("riwayat_jabatan", index, "keterangan", event.target.value)} />
                </label>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Riwayat Pangkat/Golongan" description="Data ini dipakai untuk riwayat pangkat dan perhitungan DUK.">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500">Tambahkan pangkat/golongan terdahulu atau koreksi riwayat yang ada.</span>
            <button type="button" className="btn-secondary py-2" onClick={() => addArrayItem("riwayat_pangkat", defaultRiwayatPangkat)}>
              <Plus className="h-4 w-4" />
              Tambah Riwayat Pangkat
            </button>
          </div>
          {form.riwayat_pangkat.map((item, index) => (
            <div key={`riwayat-pangkat-${index}`} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-900">Riwayat Pangkat {index + 1}</h4>
                <button type="button" className="btn-secondary py-2 text-rose-600" onClick={() => removeArrayItem("riwayat_pangkat", index, defaultRiwayatPangkat)}>
                  <Trash2 className="h-4 w-4" />
                  Hapus
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <FieldRenderer config={{ name: "pangkat_golongan", type: "datalist", listId: `list-pangkat_golongan-${index}` }} value={item.pangkat_golongan} onChange={(value) => updateArrayItem("riwayat_pangkat", index, "pangkat_golongan", value)} datalistOptions={optionMap.pangkat_golongan} />
                <label className="space-y-2">
                  <span className="label">TMT Pangkat</span>
                  <input className="input" type="date" value={item.tmt_pangkat || ""} onChange={(event) => updateArrayItem("riwayat_pangkat", index, "tmt_pangkat", event.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="label">Nomor SK</span>
                  <input className="input" value={item.nomor_sk || ""} onChange={(event) => updateArrayItem("riwayat_pangkat", index, "nomor_sk", event.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="label">Tanggal SK</span>
                  <input className="input" type="date" value={item.tanggal_sk || ""} onChange={(event) => updateArrayItem("riwayat_pangkat", index, "tanggal_sk", event.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="label">Keterangan</span>
                  <input className="input" value={item.keterangan || ""} onChange={(event) => updateArrayItem("riwayat_pangkat", index, "keterangan", event.target.value)} />
                </label>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <footer className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={() => router.back()}>Batal</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Menyimpan..." : "Simpan Pegawai"}</button>
      </footer>
    </form>
  );
}
