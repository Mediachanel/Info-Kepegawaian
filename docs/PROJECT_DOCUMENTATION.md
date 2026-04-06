# Project Documentation

This document summarizes the current state of the project: database schema,
API surface, frontend pages, and technology stack.

## Tech Stack

Backend
- Runtime: Node.js
- Framework: Next.js 14 (App Router API routes)
- ORM: Prisma 5
- Database: MySQL

Frontend
- Framework: Next.js 14 (Pages Router)
- Styling: Tailwind CSS via CDN (configured in `_document.tsx`)
- Charts: Chart.js 4 via CDN + chartjs-plugin-datalabels
- Fonts: Manrope, Space Grotesk, Plus Jakarta Sans (Google Fonts)

Tooling
- TypeScript
- Axios for API calls

## Repository Structure

Top level
- `backend/`: Next.js app used as API server
- `frontend/`: Next.js app used as UI
- `docs/`: Documentation (this file)

Backend (key files)
- `backend/src/app/api/auth/login/route.ts`: POST login endpoint
- `backend/src/app/api/auth/me/route.ts`: GET mock "me" endpoint
- `backend/src/app/api/pegawai/route.ts`: GET list of pegawai + POST create pegawai
- `backend/src/app/api/pegawai/[id]/route.ts`: GET detail by id + PUT update pegawai
- `backend/src/app/api/dashboard-stats/route.ts`: GET aggregated dashboard metrics
- `backend/src/app/api/ukpd/route.ts`: GET list of ukpd
- `backend/src/app/api/route.ts`: OPTIONS root
- `backend/src/lib/prisma.ts`: Prisma client
- `backend/src/lib/json.ts`: BigInt-safe JSON helper
- `backend/src/middleware.ts`: CORS headers
- `backend/prisma/schema.prisma`: DB schema

Frontend (key files)
- `frontend/src/pages/index.tsx`: Landing + login + FAQ UI
- `frontend/src/pages/dashboard.tsx`: Dashboard UI with KPI, charts, table
- `frontend/src/pages/pegawai.tsx`: Pegawai list + filters + create/edit modal
- `frontend/src/pages/pegawai/[id].tsx`: Pegawai profile + riwayat sections
- `frontend/src/lib/api.ts`: API client and endpoints
- `frontend/src/lib/auth.ts`: localStorage-based auth helper
- `frontend/src/lib/nav.ts`: Sidebar menu model
- `frontend/src/styles/globals.css`: Landing and dashboard styles
- `frontend/src/pages/_document.tsx`: Tailwind CDN config + fonts
- `frontend/public/foto/Dinkes.png`: Brand logo

## Database Schema (MySQL via Prisma)

Schema source: `backend/prisma/schema.prisma`

Table: `ukpd`
- `id_ukpd` (PK, bigint, autoincrement)
- `nama_ukpd` (unique, varchar(200))
- `password` (varchar(255), nullable)
- `jenis_ukpd` (varchar(100), nullable)
- `role` (varchar(50), nullable)
- `wilayah` (varchar(100), nullable)
- `created_at` (timestamp, default now)

Table: `pegawai_master`
- `id_pegawai` (PK, bigint, autoincrement)
- `nama_ukpd` (varchar(200), nullable)
- `nama` (varchar(200))
- `kondisi` (varchar(100), nullable)
- `nama_jabatan_orb` (varchar(200), nullable)
- `nama_jabatan_menpan` (varchar(200), nullable)
- `struktur_atasan_langsung` (varchar(200), nullable)
- `jenis_pegawai` (varchar(100), nullable)
- `status_rumpun` (varchar(100), nullable)
- `jenis_kontrak` (varchar(100), nullable)
- `nrk` (varchar(30), nullable)
- `nip` (varchar(30), nullable)
- `pangkat_golongan` (varchar(100), nullable)
- `tmt_pangkat_terakhir` (date, nullable)
- `jenis_kelamin` (varchar(10), nullable)
- `tmt_kerja_ukpd` (date, nullable)
- `tempat_lahir` (varchar(100), nullable)
- `tanggal_lahir` (date, nullable)
- `nik` (varchar(30), nullable)
- `agama` (varchar(50), nullable)
- `jenjang_pendidikan` (varchar(100), nullable)
- `program_studi` (varchar(150), nullable)
- `nama_universitas` (varchar(200), nullable)
- `no_hp_pegawai` (varchar(30), nullable)
- `email` (varchar(150), nullable)
- `no_bpjs` (varchar(50), nullable)
- `gelar_depan` (varchar(50), nullable)
- `gelar_belakang` (varchar(50), nullable)
- `status_perkawinan` (varchar(30), nullable)
- `created_at` (timestamp, nullable)

Table: `drh_gaji_pokok`
- `id` (PK), `id_pegawai` (FK), `tmt`, `pangkat`, `gaji`, `no_sk`, `tanggal_sk`, `created_at`

Table: `drh_hukuman_disiplin`
- `id` (PK), `id_pegawai` (FK), `tanggal_mulai`, `tanggal_akhir`, `jenis_hukuman`, `no_sk`, `tanggal_sk`, `keterangan`, `created_at`

Table: `drh_jabatan_fungsional`
- `id` (PK), `id_pegawai` (FK), `tmt`, `jabatan`, `pangkat`, `no_sk`, `tanggal_sk`, `created_at`

Table: `drh_jabatan_struktural`
- `id` (PK), `id_pegawai` (FK), `tmt`, `lokasi`, `jabatan`, `pangkat`, `eselon`, `no_sk`, `tanggal_sk`, `created_at`

Table: `drh_pangkat`
- `id` (PK), `id_pegawai` (FK), `tmt`, `pangkat`, `lokasi`, `no_sk`, `tanggal_sk`, `created_at`

Table: `drh_pendidikan_formal`
- `id` (PK), `id_pegawai` (FK), `tingkat`, `jurusan`, `tanggal_ijazah`, `nama_sekolah`, `kota`, `created_at`

Table: `drh_pendidikan_nonformal`
- `id` (PK), `id_pegawai` (FK), `nama_pelatihan`, `tanggal_ijazah`, `penyelenggara`, `kota`, `created_at`

Table: `drh_penghargaan`
- `id` (PK), `id_pegawai` (FK), `nama_penghargaan`, `asal_penghargaan`, `no_sk`, `tanggal_sk`, `created_at`

Table: `drh_skp`
- `id` (PK), `id_pegawai` (FK), `tahun`, `nilai_skp`, `nilai_perilaku`, `nilai_prestasi`, `keterangan`, `created_at`

Table: `alamat`
- `id` (PK, bigint, autoincrement)
- `id_pegawai` (FK -> pegawai_master.id_pegawai)
- `tipe` (enum: DOMISILI, KTP)
- `jalan`, `kelurahan`, `kecamatan`, `kota_kabupaten`, `provinsi` (varchar, nullable)
- `kode_provinsi`, `kode_kota_kab`, `kode_kecamatan`, `kode_kelurahan` (varchar, nullable)
- `created_at` (timestamp, default now)
- Unique: (id_pegawai, tipe)

Table: `pasangan`
- `id` (PK, bigint, autoincrement)
- `id_pegawai` (FK -> pegawai_master.id_pegawai, unique)
- `status_punya` (enum: YA, TIDAK)
- `nama`, `no_tlp`, `email`, `pekerjaan` (varchar, nullable)
- `created_at` (timestamp, default now)

Table: `anak`
- `id` (PK, bigint, autoincrement)
- `id_pegawai` (FK -> pegawai_master.id_pegawai)
- `urutan` (int)
- `nama`, `tempat_lahir`, `pekerjaan` (varchar, nullable)
- `jenis_kelamin` (enum: L, P)
- `tanggal_lahir` (date, nullable)
- `created_at` (timestamp, default now)
- Unique: (id_pegawai, urutan)

Relationships
- `pegawai_master` has many `alamat`
- `pegawai_master` has one `pasangan`
- `pegawai_master` has many `anak`
- `nama_ukpd` is a string field used for matching to `ukpd.nama_ukpd`

## API Endpoints

Base URL: `http://localhost:3000/api`

Auth
- `POST /auth/login`
  - Body: `{ "nama_ukpd": string, "password": string }`
  - Response: `{ ok: true, user: { id_ukpd, nama_ukpd, role, wilayah } }`
- `GET /auth/me`
  - Response: mock user data

Pegawai
- `GET /pegawai`
  - Returns: array of `pegawai_master` rows (default take: 100)
- `POST /pegawai`
  - Body: `{ master, alamat, pasangan, anak, gaji_pokok, hukuman_disiplin, jabatan_fungsional, jabatan_struktural, pangkat, pendidikan_formal, pendidikan_nonformal, penghargaan, skp }`
- `GET /pegawai/:id`
  - Returns: pegawai detail with `alamat`, `pasangan`, `anak`, and `drh_*` arrays
- `PUT /pegawai/:id`
  - Body: same as `POST /pegawai`

Dashboard
- `GET /dashboard-stats`
  - Returns: aggregated counts for status, UKPD, pendidikan, rumpun, gender, marital

UKPD
- `GET /ukpd`
  - Returns: list of `{ id_ukpd, nama_ukpd, wilayah }`

CORS
- Middleware allows origins: http://localhost:3000, http://localhost:3001, http://localhost:3004
- OPTIONS handlers exist on each route

## Frontend Features

Landing Page (`/`)
- Branded hero section and login form
- Status indicator for backend connectivity
- FAQ section with search and category filter

Dashboard (`/dashboard`)
- Sidebar with menu: dashboard, data pegawai, usulan (mutasi, putus JF),
  import DRH, kepangkatan, QNA (role: super only)
- KPI cards for status pegawai: PNS, CPNS, PPPK, PPPK Paruh Waktu, NON ASN, PJLP
- Charts (Chart.js): status, UKPD, pendidikan, rumpun (switchable by mode)
- Table of UKPD grouped by wilayah + filter
- Responsive sidebar

Auth and Session (frontend)
- Login stores user info in localStorage via `auth.ts`
- Token stored in localStorage if backend returns `token`
- Role normalization: super, wilayah, ukpd

## Configuration

Frontend
- `frontend/.env.local`
  - `NEXT_PUBLIC_API_URL` (default: `http://localhost:3000`)
- `frontend/src/lib/api.ts` builds base URL from `NEXT_PUBLIC_API_URL`

Backend
- `backend/.env` (not committed)
  - `DATABASE_URL` for Prisma

## Known Issues

- `/api/ukpd` currently returns 404 in dev. The route exists at
  `backend/src/app/api/ukpd/route.ts`, but it is not emitted in `.next`.
  Needs investigation or server restart to rebuild routes.

## Run Commands

Backend
- `npm run dev` in `backend`

Frontend
- `npm run dev` in `frontend`
