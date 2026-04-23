from __future__ import annotations

from datetime import datetime, timezone
from hashlib import md5
from html.parser import HTMLParser
from pathlib import Path
import re
import sys


EXPORT_PATH = Path(
    r"C:\Users\Dinkes_laptop3\Downloads\export_pegawai_full_riwayat3_alamat_keluarga_20260423_140308.xls"
)
OUTPUT_PATH = Path(r"D:\Sistem Informasi\sql\per-ukpd\220004_dinas-kesehatan_riwayat-pangkat.sql")

RIWAYAT_PANGKAT_COLUMNS = [
    "id_pegawai",
    "nip",
    "nama_pegawai",
    "pangkat_golongan",
    "tmt_pangkat",
    "nomor_sk",
    "tanggal_sk",
    "keterangan",
    "sumber",
    "source_key",
]

CREATE_TABLE_SQL = """CREATE DATABASE IF NOT EXISTS `si_data` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `si_data`;

CREATE TABLE IF NOT EXISTS `riwayat_pangkat` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `id_pegawai` INT NOT NULL,
  `nip` VARCHAR(64) NULL,
  `nama_pegawai` VARCHAR(255) NOT NULL,
  `pangkat_golongan` VARCHAR(120) NULL,
  `tmt_pangkat` VARCHAR(30) NULL,
  `nomor_sk` VARCHAR(120) NULL,
  `tanggal_sk` VARCHAR(30) NULL,
  `keterangan` TEXT NULL,
  `sumber` VARCHAR(80) NULL,
  `source_key` VARCHAR(191) NOT NULL,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_riwayat_pangkat_source` (`source_key`),
  KEY `idx_riwayat_pangkat_pegawai` (`id_pegawai`),
  KEY `idx_riwayat_pangkat_golongan` (`pangkat_golongan`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"""


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


def parse_rows(path: Path) -> list[list[str]]:
    parser = TableParser()
    parser.feed(path.read_text(encoding="utf-8", errors="ignore"))
    return parser.rows


def parse_created_at_from_name(path: Path) -> str:
    match = re.search(r"_(\d{8})_(\d{6})", path.stem)
    if not match:
        return datetime.now().strftime("%Y-%m-%d")
    date_part = match.group(1)
    return f"{date_part[:4]}-{date_part[4:6]}-{date_part[6:8]}"


def parse_sk(raw_value: str | None) -> tuple[str | None, str | None]:
    cleaned = clean_text(raw_value)
    if cleaned is None:
        return (None, None)

    nomor_sk = cleaned
    tanggal_sk = None

    match = re.search(r"^(.*?)\s*\((\d{4}-\d{2}-\d{2})\)\s*$", cleaned)
    if match:
        nomor_sk = clean_text(match.group(1))
        tanggal_sk = match.group(2)

    if nomor_sk and nomor_sk.upper().startswith("SK:"):
        nomor_sk = clean_text(nomor_sk[3:])

    return (nomor_sk, tanggal_sk)


def escape_sql_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "''").replace("\x00", "")


def to_sql_value(value) -> str:
    if value is None:
        return "NULL"
    text = str(value).strip()
    if not text:
        return "NULL"
    return f"'{escape_sql_string(text)}'"


def build_insert(rows: list[dict], chunk_size: int = 500) -> str:
    update_columns = [column for column in RIWAYAT_PANGKAT_COLUMNS if column != "source_key"]
    update_clause = ", ".join(f"`{column}` = VALUES(`{column}`)" for column in update_columns)
    statements: list[str] = []

    for start in range(0, len(rows), chunk_size):
        chunk = rows[start : start + chunk_size]
        values_sql = ",\n".join(
            "(" + ", ".join(to_sql_value(row.get(column)) for column in RIWAYAT_PANGKAT_COLUMNS) + ")"
            for row in chunk
        )
        statements.append(
            "INSERT INTO `riwayat_pangkat` ("
            + ", ".join(f"`{column}`" for column in RIWAYAT_PANGKAT_COLUMNS)
            + ") VALUES\n"
            + values_sql
            + "\nON DUPLICATE KEY UPDATE "
            + update_clause
            + ";"
        )

    return "\n\n".join(statements)


def make_source_key(id_pegawai: int, urutan: int, pangkat: str | None, tmt: str | None, nomor_sk: str | None) -> str:
    raw = "|".join(
        [
            str(id_pegawai),
            "dinkes_export_riwayat_pangkat",
            str(urutan),
            pangkat or "",
            tmt or "",
            nomor_sk or "",
        ]
    )
    return md5(raw.encode("utf-8")).hexdigest()


def build_rows(data_rows: list[list[str]]) -> list[dict]:
    inserts: list[dict] = []

    # 3 riwayat blocks from the export:
    # tmt, masa kerja, jabatan, golongan, nomor sk
    blocks = [
        (1, 41, 42, 43, 44, 45),
        (2, 46, 47, 48, 49, 50),
        (3, 51, 52, 53, 54, 55),
    ]

    for row in data_rows:
        if len(row) < 56:
            continue

        id_pegawai = int(row[36].strip())
        nip = clean_text(row[37]) or clean_text(row[2])
        nama = clean_text(row[8]) or f"Pegawai {id_pegawai}"

        for urutan, idx_tmt, idx_mk, idx_jabatan, idx_gol, idx_sk in blocks:
            tmt = clean_text(row[idx_tmt])
            masa_kerja = clean_text(row[idx_mk])
            jabatan = clean_text(row[idx_jabatan])
            pangkat = clean_text(row[idx_gol])
            nomor_sk, tanggal_sk = parse_sk(row[idx_sk])

            if not any([tmt, jabatan, pangkat, nomor_sk]):
                continue

            keterangan_parts = [part for part in [jabatan, f"Masa kerja: {masa_kerja}" if masa_kerja else None] if part]
            inserts.append(
                {
                    "id_pegawai": id_pegawai,
                    "nip": nip,
                    "nama_pegawai": nama,
                    "pangkat_golongan": pangkat,
                    "tmt_pangkat": tmt,
                    "nomor_sk": nomor_sk,
                    "tanggal_sk": tanggal_sk,
                    "keterangan": " | ".join(keterangan_parts) if keterangan_parts else None,
                    "sumber": f"dinkes_export_riwayat_{urutan}",
                    "source_key": make_source_key(id_pegawai, urutan, pangkat, tmt, nomor_sk),
                }
            )

    return inserts


def main() -> int:
    if not EXPORT_PATH.exists():
        print(f"Export file not found: {EXPORT_PATH}", file=sys.stderr)
        return 1

    rows = parse_rows(EXPORT_PATH)
    if len(rows) < 3:
        print("Export table is empty or invalid", file=sys.stderr)
        return 1

    created_at = parse_created_at_from_name(EXPORT_PATH)
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    data_rows = rows[2:]
    inserts = build_rows(data_rows)

    sql = f"""-- Auto generated on {generated_at}
-- Source export: {EXPORT_PATH.name}
-- UKPD: Dinas Kesehatan (id_ukpd=220004)
SET NAMES utf8mb4;
{CREATE_TABLE_SQL}

-- Data riwayat pangkat diambil dari tiga blok riwayat pada export HTML Dinkes.
-- `keterangan` menyimpan jabatan pada periode tersebut dan masa kerjanya.
-- `created_at` row menggunakan default tabel; tanggal import sumber = {created_at}.

{build_insert(inserts)}
"""

    OUTPUT_PATH.write_text(sql, encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")
    print(f"Inserted riwayat_pangkat rows: {len(inserts)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
