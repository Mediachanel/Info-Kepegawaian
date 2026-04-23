from __future__ import annotations

from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
import re
import sys


EXPORT_PATH = Path(
    r"C:\Users\Dinkes_laptop3\Downloads\export_pegawai_full_riwayat3_alamat_keluarga_20260423_140308.xls"
)
OUTPUT_PATH = Path(r"D:\Sistem Informasi\sql\per-ukpd\220004_dinas-kesehatan_keluarga.sql")

PASANGAN_COLUMNS = [
    "id",
    "id_pegawai",
    "status_punya",
    "nama",
    "no_tlp",
    "email",
    "pekerjaan",
    "created_at",
]

ANAK_COLUMNS = [
    "id",
    "id_pegawai",
    "urutan",
    "nama",
    "jenis_kelamin",
    "tempat_lahir",
    "tanggal_lahir",
    "pekerjaan",
    "created_at",
]

CREATE_TABLE_SQL = """CREATE DATABASE IF NOT EXISTS `si_data` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `si_data`;

CREATE TABLE IF NOT EXISTS `pasangan` (
  `id` INT NOT NULL,
  `id_pegawai` INT NOT NULL,
  `status_punya` VARCHAR(30) NULL,
  `nama` VARCHAR(255) NULL,
  `no_tlp` VARCHAR(50) NULL,
  `email` VARCHAR(255) NULL,
  `pekerjaan` VARCHAR(255) NULL,
  `created_at` DATE NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pasangan_pegawai` (`id_pegawai`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `anak` (
  `id` INT NOT NULL,
  `id_pegawai` INT NOT NULL,
  `urutan` TINYINT NOT NULL,
  `nama` VARCHAR(255) NULL,
  `jenis_kelamin` VARCHAR(30) NULL,
  `tempat_lahir` VARCHAR(100) NULL,
  `tanggal_lahir` VARCHAR(30) NULL,
  `pekerjaan` VARCHAR(255) NULL,
  `created_at` DATE NULL,
  PRIMARY KEY (`id`),
  KEY `idx_anak_pegawai` (`id_pegawai`),
  KEY `idx_anak_urutan` (`urutan`)
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


def normalize_gender(value: str | None) -> str | None:
    cleaned = clean_text(value)
    if cleaned is None:
        return None
    upper = cleaned.upper()
    if upper in {"L", "LAKI-LAKI", "LAKI LAKI"}:
        return "Laki-laki"
    if upper in {"P", "PEREMPUAN"}:
        return "Perempuan"
    return cleaned


def parse_person_segment(segment: str, label_pattern: str) -> dict | None:
    text = clean_text(segment)
    if text is None:
        return None

    normalized = re.sub(r"\s+", " ", text)
    normalized = re.sub(label_pattern, "", normalized, count=1, flags=re.IGNORECASE).strip(" :")

    if not normalized:
        return None

    match = re.match(r"^(?P<nama>.+?)(?:\s*\((?P<tanggal>\d{4}-\d{2}-\d{2})\))?(?:\s*/\s*(?P<gender>[^/]+))?$", normalized)
    if not match:
        return {"nama": normalized, "tanggal_lahir": None, "jenis_kelamin": None}

    return {
        "nama": clean_text(match.group("nama")),
        "tanggal_lahir": clean_text(match.group("tanggal")),
        "jenis_kelamin": normalize_gender(match.group("gender")),
    }


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


def build_insert(table_name: str, columns: list[str], rows: list[dict], key_column: str = "id") -> str:
    if not rows:
        return f"-- Tidak ada data untuk `{table_name}`."

    update_columns = [column for column in columns if column != key_column]
    update_clause = ", ".join(f"`{column}` = VALUES(`{column}`)" for column in update_columns)
    values_sql = ",\n".join(
        "(" + ", ".join(to_sql_value(row.get(column)) for column in columns) + ")"
        for row in rows
    )
    return (
        f"INSERT INTO `{table_name}` ({', '.join(f'`{column}`' for column in columns)}) VALUES\n"
        f"{values_sql}\n"
        f"ON DUPLICATE KEY UPDATE {update_clause};"
    )


def build_rows(data_rows: list[list[str]], created_at: str) -> tuple[list[dict], list[dict]]:
    pasangan_rows: list[dict] = []
    anak_rows: list[dict] = []
    pasangan_seen: set[int] = set()

    for row in data_rows:
        if len(row) < 41:
            continue

        id_pegawai = int(row[36].strip())
        keluarga_raw = clean_text(row[40])
        if keluarga_raw is None:
            continue

        segments = [segment.strip() for segment in keluarga_raw.split("|") if segment.strip()]
        anak_urutan = 0

        for segment in segments:
            upper = segment.upper()
            if upper.startswith("SUAMI") or upper.startswith("ISTRI"):
                spouse = parse_person_segment(segment, r"^(SUAMI\s*/\s*ISTRI|SUAMI\s*/\s*ISTERI|SUAMI/ISTRI|SUAMI|ISTRI|ISTERI)")
                if spouse and spouse.get("nama") and id_pegawai not in pasangan_seen:
                    pasangan_rows.append(
                        {
                            "id": id_pegawai * 10 + 1,
                            "id_pegawai": id_pegawai,
                            "status_punya": "Ya",
                            "nama": spouse["nama"],
                            "no_tlp": None,
                            "email": None,
                            "pekerjaan": None,
                            "created_at": created_at,
                        }
                    )
                    pasangan_seen.add(id_pegawai)
            elif upper.startswith("ANAK"):
                child = parse_person_segment(segment, r"^ANAK(?:\s+\d+)?")
                if child and child.get("nama"):
                    anak_urutan += 1
                    anak_rows.append(
                        {
                            "id": id_pegawai * 10 + anak_urutan,
                            "id_pegawai": id_pegawai,
                            "urutan": anak_urutan,
                            "nama": child["nama"],
                            "jenis_kelamin": child["jenis_kelamin"],
                            "tempat_lahir": None,
                            "tanggal_lahir": child["tanggal_lahir"],
                            "pekerjaan": None,
                            "created_at": created_at,
                        }
                    )

    return pasangan_rows, anak_rows


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
    pasangan_rows, anak_rows = build_rows(rows[2:], created_at)

    sql = f"""-- Auto generated on {generated_at}
-- Source export: {EXPORT_PATH.name}
-- UKPD: Dinas Kesehatan (id_ukpd=220004)
SET NAMES utf8mb4;
{CREATE_TABLE_SQL}

-- Catatan:
-- Export Dinkes hanya menyediakan kolom `Data Keluarga (Ringkas)`.
-- File ini memecah kolom ringkas itu menjadi tabel `pasangan` dan `anak`.
-- Detail seperti no_tlp, email, pekerjaan, dan tempat_lahir anak tidak tersedia pada export ini.

{build_insert("pasangan", PASANGAN_COLUMNS, pasangan_rows)}

{build_insert("anak", ANAK_COLUMNS, anak_rows)}
"""

    OUTPUT_PATH.write_text(sql, encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")
    print(f"Inserted pasangan rows: {len(pasangan_rows)}")
    print(f"Inserted anak rows: {len(anak_rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
