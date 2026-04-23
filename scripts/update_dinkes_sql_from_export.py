from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
import re
import sys


EXPORT_PATH = Path(
    r"C:\Users\Dinkes_laptop3\Downloads\export_pegawai_full_riwayat3_alamat_keluarga_20260423_140308.xls"
)
OUTPUT_PATH = Path(r"D:\Sistem Informasi\sql\per-ukpd\220004_dinas-kesehatan.sql")

TARGET_UKPD_ID = 220004
TARGET_UKPD_NAME = "Dinas Kesehatan"
TARGET_UKPD_JENIS = "Dinkes"
TARGET_WILAYAH = "Jakarta Pusat"
TARGET_ROLE = "SUPER_ADMIN"

UKPD_COLUMNS = [
    "id_ukpd",
    "ukpd_id",
    "nama_ukpd",
    "password",
    "jenis_ukpd",
    "role",
    "wilayah",
    "created_at",
]

PEGAWAI_COLUMNS = [
    "id_pegawai",
    "nama",
    "jenis_kelamin",
    "tempat_lahir",
    "tanggal_lahir",
    "nik",
    "agama",
    "nama_ukpd",
    "jenis_ukpd",
    "wilayah",
    "jenis_pegawai",
    "status_rumpun",
    "jenis_kontrak",
    "nrk",
    "nip",
    "nama_jabatan_orb",
    "nama_jabatan_menpan",
    "struktur_atasan_langsung",
    "pangkat_golongan",
    "tmt_pangkat_terakhir",
    "jenjang_pendidikan",
    "program_studi",
    "nama_universitas",
    "no_hp_pegawai",
    "email",
    "no_bpjs",
    "kondisi",
    "status_perkawinan",
    "gelar_depan",
    "gelar_belakang",
    "tmt_kerja_ukpd",
    "created_at",
    "id_ukpd",
    "ukpd_id",
    "jenjang_pendidikan_raw",
    "status_rumpun_raw",
    "nama_jabatan_menpan_raw",
    "jenis_kelamin_raw",
]

SCHEMA_SQL = """CREATE DATABASE IF NOT EXISTS `sisdmk2` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `sisdmk2`;

CREATE TABLE IF NOT EXISTS `ukpd` (
  `id_ukpd` INT NOT NULL,
  `ukpd_id` INT NULL,
  `nama_ukpd` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NULL,
  `jenis_ukpd` VARCHAR(100) NULL,
  `role` VARCHAR(50) NULL,
  `wilayah` VARCHAR(100) NULL,
  `created_at` DATE NULL,
  PRIMARY KEY (`id_ukpd`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pegawai` (
  `id_pegawai` INT NOT NULL,
  `nama` VARCHAR(255) NOT NULL,
  `jenis_kelamin` VARCHAR(30) NULL,
  `tempat_lahir` VARCHAR(150) NULL,
  `tanggal_lahir` VARCHAR(30) NULL,
  `nik` VARCHAR(64) NULL,
  `agama` VARCHAR(50) NULL,
  `nama_ukpd` VARCHAR(255) NULL,
  `jenis_ukpd` VARCHAR(100) NULL,
  `wilayah` VARCHAR(100) NULL,
  `jenis_pegawai` VARCHAR(80) NULL,
  `status_rumpun` VARCHAR(255) NULL,
  `jenis_kontrak` VARCHAR(80) NULL,
  `nrk` VARCHAR(64) NULL,
  `nip` VARCHAR(64) NULL,
  `nama_jabatan_orb` VARCHAR(255) NULL,
  `nama_jabatan_menpan` VARCHAR(255) NULL,
  `struktur_atasan_langsung` VARCHAR(255) NULL,
  `pangkat_golongan` VARCHAR(120) NULL,
  `tmt_pangkat_terakhir` VARCHAR(30) NULL,
  `jenjang_pendidikan` VARCHAR(80) NULL,
  `program_studi` VARCHAR(255) NULL,
  `nama_universitas` VARCHAR(255) NULL,
  `no_hp_pegawai` VARCHAR(64) NULL,
  `email` VARCHAR(255) NULL,
  `no_bpjs` VARCHAR(100) NULL,
  `kondisi` VARCHAR(50) NULL,
  `status_perkawinan` VARCHAR(50) NULL,
  `gelar_depan` VARCHAR(120) NULL,
  `gelar_belakang` VARCHAR(255) NULL,
  `tmt_kerja_ukpd` VARCHAR(30) NULL,
  `created_at` DATE NULL,
  `id_ukpd` INT NULL,
  `ukpd_id` INT NULL,
  `jenjang_pendidikan_raw` VARCHAR(80) NULL,
  `status_rumpun_raw` VARCHAR(255) NULL,
  `nama_jabatan_menpan_raw` VARCHAR(255) NULL,
  `jenis_kelamin_raw` VARCHAR(80) NULL,
  PRIMARY KEY (`id_pegawai`),
  KEY `idx_pegawai_nip` (`nip`),
  KEY `idx_pegawai_ukpd` (`id_ukpd`),
  CONSTRAINT `fk_pegawai_ukpd` FOREIGN KEY (`id_ukpd`) REFERENCES `ukpd` (`id_ukpd`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"""

COMPAT_SQL = """ALTER TABLE `pegawai`
  MODIFY `tanggal_lahir` VARCHAR(30) NULL,
  MODIFY `tmt_kerja_ukpd` VARCHAR(30) NULL;"""


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_tr = False
        self.in_td = False
        self.current_row: list[str] = []
        self.rows: list[list[str]] = []
        self.buffer: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "tr":
            self.in_tr = True
            self.current_row = []
        elif tag in {"td", "th"} and self.in_tr:
            self.in_td = True
            self.buffer = []
        elif tag == "br" and self.in_td:
            self.buffer.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self.in_td:
            self.in_td = False
            self.current_row.append("".join(self.buffer).strip())
        elif tag == "tr" and self.in_tr:
            self.in_tr = False
            if any(cell.strip() for cell in self.current_row):
                self.rows.append(self.current_row)

    def handle_data(self, data: str) -> None:
        if self.in_td:
            self.buffer.append(data)


def clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).replace("\xa0", " ").strip()
    if not text:
        return None
    if text in {"-", "(Tidak Tercatat)", "0", "0.0"}:
        return None
    return text


def pick(*values: str | None) -> str | None:
    for value in values:
        cleaned = clean_text(value)
        if cleaned is not None:
            return cleaned
    return None


def normalize_gender(value: str | None) -> str | None:
    cleaned = clean_text(value)
    if cleaned is None:
        return None
    upper = cleaned.upper()
    if upper == "L":
        return "Laki-laki"
    if upper == "P":
        return "Perempuan"
    if upper in {"LAKI-LAKI", "LAKI LAKI"}:
        return "Laki-laki"
    if upper == "PEREMPUAN":
        return "Perempuan"
    return cleaned


def normalize_upper(value: str | None) -> str | None:
    cleaned = clean_text(value)
    return cleaned.upper() if cleaned else None


def normalize_ukpd_id(value: str | None) -> int:
    cleaned = clean_text(value)
    if not cleaned:
        return TARGET_UKPD_ID
    cleaned = cleaned.replace(".0", "")
    if cleaned.isdigit():
        return int(cleaned)
    return TARGET_UKPD_ID


def parse_created_at_from_name(path: Path) -> str:
    match = re.search(r"_(\d{8})_(\d{6})", path.stem)
    if not match:
        return datetime.now().strftime("%Y-%m-%d")
    date_part = match.group(1)
    return f"{date_part[:4]}-{date_part[4:6]}-{date_part[6:8]}"


def escape_sql_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "''").replace("\x00", "")


def to_sql_value(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, int):
        return str(value)
    text = str(value).strip()
    if not text:
        return "NULL"
    return f"'{escape_sql_string(text)}'"


def build_insert(table_name: str, rows: list[dict], columns: list[str], chunk_size: int) -> str:
    statements: list[str] = []
    update_columns = [column for column in columns if not column.startswith("id_")]
    update_clause = ", ".join(f"`{column}` = VALUES(`{column}`)" for column in update_columns)
    for start in range(0, len(rows), chunk_size):
        chunk = rows[start : start + chunk_size]
        values_sql = ",\n".join(
            "(" + ", ".join(to_sql_value(row.get(column)) for column in columns) + ")" for row in chunk
        )
        statements.append(
            f"INSERT INTO `{table_name}` ({', '.join(f'`{column}`' for column in columns)}) VALUES\n"
            f"{values_sql}\n"
            f"ON DUPLICATE KEY UPDATE {update_clause};"
        )
    return "\n\n".join(statements)


def parse_rows(path: Path) -> list[list[str]]:
    parser = TableParser()
    parser.feed(path.read_text(encoding="utf-8", errors="ignore"))
    return parser.rows


def build_mapped_rows(data_rows: list[list[str]], created_at: str) -> list[dict]:
    mapped: list[dict] = []
    jenis_counter: Counter[str] = Counter()
    source_ukpd_counter: Counter[str] = Counter()

    for row in data_rows:
        source_ukpd_counter[str(normalize_ukpd_id(row[3]))] += 1
        jenis_counter[pick(row[5]) or TARGET_UKPD_JENIS] += 1

        nama_jabatan_menpan_raw = pick(row[14], row[13], row[12])
        mapped.append(
            {
                "id_pegawai": int(row[36].strip()),
                "nama": pick(row[8]),
                "jenis_kelamin": normalize_gender(row[22]),
                "tempat_lahir": pick(row[24]),
                "tanggal_lahir": pick(row[25]),
                "nik": pick(row[1]),
                "agama": normalize_upper(row[26]),
                "nama_ukpd": TARGET_UKPD_NAME,
                "jenis_ukpd": pick(row[5]) or TARGET_UKPD_JENIS,
                "wilayah": pick(row[6]) or TARGET_WILAYAH,
                "jenis_pegawai": pick(row[15]),
                "status_rumpun": pick(row[17]),
                "jenis_kontrak": pick(row[18]),
                "nrk": pick(row[7]),
                "nip": pick(row[37], row[2]),
                "nama_jabatan_orb": pick(row[12]),
                "nama_jabatan_menpan": nama_jabatan_menpan_raw,
                "struktur_atasan_langsung": pick(row[39]),
                "pangkat_golongan": pick(row[19]),
                "tmt_pangkat_terakhir": pick(row[21]),
                "jenjang_pendidikan": pick(row[27], row[28]),
                "program_studi": pick(row[29]),
                "nama_universitas": pick(row[30]),
                "no_hp_pegawai": pick(row[31]),
                "email": pick(row[32]),
                "no_bpjs": pick(row[33]),
                "kondisi": normalize_upper(pick(row[11], row[35])),
                "status_perkawinan": normalize_upper(row[34]),
                "gelar_depan": pick(row[9]),
                "gelar_belakang": pick(row[10]),
                "tmt_kerja_ukpd": pick(row[23]),
                "created_at": created_at,
                "id_ukpd": TARGET_UKPD_ID,
                "ukpd_id": TARGET_UKPD_ID,
                "jenjang_pendidikan_raw": pick(row[28], row[27]),
                "status_rumpun_raw": pick(row[17]),
                "nama_jabatan_menpan_raw": nama_jabatan_menpan_raw,
                "jenis_kelamin_raw": pick(row[22]),
            }
        )

    print(f"Parsed {len(mapped)} pegawai rows")
    print(f"Source UKPD IDs: {dict(source_ukpd_counter)}")
    print(f"Source jenis_ukpd counts: {dict(jenis_counter)}")
    return mapped


def main() -> int:
    if not EXPORT_PATH.exists():
        print(f"Export file not found: {EXPORT_PATH}", file=sys.stderr)
        return 1

    rows = parse_rows(EXPORT_PATH)
    if len(rows) < 3:
        print("Export table is empty or invalid", file=sys.stderr)
        return 1

    header = rows[0]
    second_header = rows[1]
    data_rows = rows[2:]

    if header[:5] != ["No", "NIK", "NIP", "UKPD ID", "Nama UKPD"]:
        print("Unexpected export header format", file=sys.stderr)
        return 1
    if len(second_header) != 15:
        print("Unexpected second header format", file=sys.stderr)
        return 1

    created_at = parse_created_at_from_name(EXPORT_PATH)
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    pegawai_rows = build_mapped_rows(data_rows, created_at)
    ids = [row["id_pegawai"] for row in pegawai_rows]
    if len(ids) != len(set(ids)):
        print("Duplicate id_pegawai detected in export", file=sys.stderr)
        return 1

    ukpd_row = {
        "id_ukpd": TARGET_UKPD_ID,
        "ukpd_id": TARGET_UKPD_ID,
        "nama_ukpd": TARGET_UKPD_NAME,
        "password": None,
        "jenis_ukpd": TARGET_UKPD_JENIS,
        "role": TARGET_ROLE,
        "wilayah": TARGET_WILAYAH,
        "created_at": created_at,
    }

    sql = f"""-- Auto generated on {generated_at}
-- Source export: {EXPORT_PATH.name}
-- UKPD: {TARGET_UKPD_NAME} (id_ukpd={TARGET_UKPD_ID})
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
{SCHEMA_SQL}
{COMPAT_SQL}

{build_insert("ukpd", [ukpd_row], UKPD_COLUMNS, 1)}

{build_insert("pegawai", pegawai_rows, PEGAWAI_COLUMNS, 500)}

SET FOREIGN_KEY_CHECKS = 1;
"""

    OUTPUT_PATH.write_text(sql, encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
