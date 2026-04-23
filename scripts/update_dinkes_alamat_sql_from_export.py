from __future__ import annotations

from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
import re
import sys


EXPORT_PATH = Path(
    r"C:\Users\Dinkes_laptop3\Downloads\export_pegawai_full_riwayat3_alamat_keluarga_20260423_140308.xls"
)
OUTPUT_PATH = Path(r"D:\Sistem Informasi\sql\per-ukpd\220004_dinas-kesehatan_alamat.sql")

ALAMAT_COLUMNS = [
    "id",
    "id_pegawai",
    "tipe",
    "jalan",
    "kelurahan",
    "kecamatan",
    "kota_kabupaten",
    "provinsi",
    "kode_provinsi",
    "kode_kota_kab",
    "kode_kecamatan",
    "kode_kelurahan",
    "created_at",
]

KNOWN_PROVINCES = {
    "ACEH",
    "SUMATERA UTARA",
    "SUMATERA BARAT",
    "RIAU",
    "KEPULAUAN RIAU",
    "JAMBI",
    "SUMATERA SELATAN",
    "BENGKULU",
    "LAMPUNG",
    "BANTEN",
    "DKI JAKARTA",
    "JAWA BARAT",
    "JAWA TENGAH",
    "DAERAH ISTIMEWA YOGYAKARTA",
    "DI YOGYAKARTA",
    "JAWA TIMUR",
    "BALI",
    "NUSA TENGGARA BARAT",
    "NUSA TENGGARA TIMUR",
    "KALIMANTAN BARAT",
    "KALIMANTAN TENGAH",
    "KALIMANTAN SELATAN",
    "KALIMANTAN TIMUR",
    "KALIMANTAN UTARA",
    "SULAWESI UTARA",
    "SULAWESI TENGAH",
    "SULAWESI SELATAN",
    "SULAWESI TENGGARA",
    "GORONTALO",
    "SULAWESI BARAT",
    "MALUKU",
    "MALUKU UTARA",
    "PAPUA",
    "PAPUA BARAT",
    "PAPUA SELATAN",
    "PAPUA TENGAH",
    "PAPUA PEGUNUNGAN",
    "PAPUA BARAT DAYA",
}


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
    if not text or text == "-":
        return None
    return text


def normalize_province(value: str | None) -> str | None:
    cleaned = clean_text(value)
    if cleaned is None:
        return None
    upper = cleaned.upper()
    if upper not in KNOWN_PROVINCES:
        return None
    if upper == "DI YOGYAKARTA":
        return "DAERAH ISTIMEWA YOGYAKARTA"
    return upper


def parse_created_at_from_name(path: Path) -> str:
    match = re.search(r"_(\d{8})_(\d{6})", path.stem)
    if not match:
        return datetime.now().strftime("%Y-%m-%d")
    date_part = match.group(1)
    return f"{date_part[:4]}-{date_part[4:6]}-{date_part[6:8]}"


def parse_rows(path: Path) -> list[list[str]]:
    parser = TableParser()
    parser.feed(path.read_text(encoding="utf-8", errors="ignore"))
    return parser.rows


def split_address(address: str) -> tuple[str | None, str | None, str | None, str | None, str | None]:
    cleaned = clean_text(address)
    if cleaned is None:
        return (None, None, None, None, None)

    parts = [part.strip() for part in cleaned.split(",") if part.strip()]
    if len(parts) < 5:
        return (cleaned, None, None, None, None)

    province = normalize_province(parts[-1])
    if province is None:
        return (cleaned, None, None, None, None)

    kota = clean_text(parts[-2])
    kecamatan = clean_text(parts[-3])
    kelurahan = clean_text(parts[-4])
    jalan = clean_text(", ".join(parts[:-4])) or cleaned
    return (jalan, kelurahan, kecamatan, kota, province)


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


def build_insert(rows: list[dict], chunk_size: int = 500) -> str:
    statements: list[str] = []
    update_columns = [column for column in ALAMAT_COLUMNS if column != "id"]
    update_clause = ", ".join(f"`{column}` = VALUES(`{column}`)" for column in update_columns)
    for start in range(0, len(rows), chunk_size):
        chunk = rows[start : start + chunk_size]
        values_sql = ",\n".join(
            "(" + ", ".join(to_sql_value(row.get(column)) for column in ALAMAT_COLUMNS) + ")" for row in chunk
        )
        statements.append(
            "INSERT INTO `alamat` ("
            + ", ".join(f"`{column}`" for column in ALAMAT_COLUMNS)
            + ") VALUES\n"
            + values_sql
            + "\nON DUPLICATE KEY UPDATE "
            + update_clause
            + ";"
        )
    return "\n\n".join(statements)


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
    inserts: list[dict] = []
    nonblank_count = 0

    for row in data_rows:
        alamat_raw = clean_text(row[38])
        if alamat_raw is None:
            continue
        nonblank_count += 1
        id_pegawai = int(row[36].strip())
        jalan, kelurahan, kecamatan, kota, provinsi = split_address(alamat_raw)

        for suffix, tipe in ((1, "domisili"), (2, "ktp")):
            inserts.append(
                {
                    "id": id_pegawai * 10 + suffix,
                    "id_pegawai": id_pegawai,
                    "tipe": tipe,
                    "jalan": jalan,
                    "kelurahan": kelurahan,
                    "kecamatan": kecamatan,
                    "kota_kabupaten": kota,
                    "provinsi": provinsi,
                    "kode_provinsi": None,
                    "kode_kota_kab": None,
                    "kode_kecamatan": None,
                    "kode_kelurahan": None,
                    "created_at": created_at,
                }
            )

    sql = f"""-- Auto generated on {generated_at}
-- Source export: {EXPORT_PATH.name}
-- UKPD: Dinas Kesehatan (id_ukpd=220004)
-- Asumsi: kolom sumber hanya memiliki satu alamat gabungan "Alamat (Domisili/KTP)",
-- sehingga alamat yang sama diisikan ke tipe `domisili` dan `ktp`.
-- Jalankan setelah sql/create_alamat_riwayat_tables.sql
SET NAMES utf8mb4;
USE `si_data`;

{build_insert(inserts)}
"""

    OUTPUT_PATH.write_text(sql, encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")
    print(f"Nonblank alamat rows: {nonblank_count}")
    print(f"Inserted alamat tuples: {len(inserts)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
