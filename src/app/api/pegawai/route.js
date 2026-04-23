import { z } from "zod";
import { filterPegawaiByRole, getPegawaiWilayah } from "@/lib/auth/access";
import { requireAuth } from "@/lib/auth/requireAuth";
import { fail, ok } from "@/lib/helpers/response";
import { createPegawaiData, getPegawaiData, getUkpdData } from "@/lib/data/pegawaiStore";
import { getConnectedPool } from "@/lib/db/mysql";
import { getPegawaiPhotoUrl, savePegawaiPhoto } from "@/lib/helpers/pegawaiPhoto";
import { ROLES } from "@/lib/constants/roles";

const schema = z.object({
  nama: z.string().min(3),
  nama_ukpd: z.string().min(3),
  jenis_pegawai: z.string().min(2),
  nip: z.string().optional(),
  nik: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  jenis_kelamin: z.string().optional(),
  kondisi: z.string().optional()
}).passthrough();

function numberParam(value, fallback, min, max) {
  const number = Number.parseInt(value || "", 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function cleanNip(value) {
  return String(value || "").trim().replace(/^`+/, "");
}

function normalizePegawaiRows(rows) {
  return rows.map((row) => ({
    ...row,
    nip: cleanNip(row.nip)
  }));
}

function addWhere(parts, params, clause, values = []) {
  parts.push(clause);
  params.push(...values);
}

async function getPegawaiPage({ user, q, status, wilayah, ukpd, page, pageSize, exportAll = false }) {
  const pool = await getConnectedPool();
  const where = [];
  const params = [];

  if (user.role === ROLES.ADMIN_UKPD) {
    addWhere(where, params, "p.`nama_ukpd` = ?", [user.nama_ukpd]);
  } else if (user.role === ROLES.ADMIN_WILAYAH) {
    addWhere(where, params, "COALESCE(NULLIF(p.`wilayah`, ''), u.`wilayah`) = ?", [user.wilayah]);
  } else if (user.role !== ROLES.SUPER_ADMIN) {
    addWhere(where, params, "1 = 0");
  }

  if (q) {
    const keyword = `%${q}%`;
    addWhere(
      where,
      params,
      "(p.`nama` LIKE ? OR p.`nip` LIKE ? OR p.`nama_jabatan_menpan` LIKE ? OR p.`nama_jabatan_orb` LIKE ? OR p.`nama_ukpd` LIKE ?)",
      [keyword, keyword, keyword, keyword, keyword]
    );
  }
  if (status) addWhere(where, params, "p.`jenis_pegawai` = ?", [status]);
  if (wilayah) addWhere(where, params, "COALESCE(NULLIF(p.`wilayah`, ''), u.`wilayah`) = ?", [wilayah]);
  if (ukpd) addWhere(where, params, "p.`nama_ukpd` = ?", [ukpd]);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const joinSql = "LEFT JOIN `ukpd` u ON u.`nama_ukpd` = p.`nama_ukpd`";
  const offset = (page - 1) * pageSize;
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM \`pegawai\` p ${joinSql} ${whereSql}`, params);
  const [rows] = await pool.query(
    `SELECT p.*, COALESCE(NULLIF(p.\`wilayah\`, ''), u.\`wilayah\`, '-') AS \`wilayah\`
     FROM \`pegawai\` p
     ${joinSql}
     ${whereSql}
     ORDER BY p.\`nama\` ASC, p.\`id_pegawai\` ASC
     ${exportAll ? "" : "LIMIT ? OFFSET ?"}`,
    exportAll ? params : [...params, pageSize, offset]
  );

  const scopedUkpdWhere = [];
  const scopedUkpdParams = [];
  if (user.role === ROLES.ADMIN_UKPD) {
    addWhere(scopedUkpdWhere, scopedUkpdParams, "`nama_ukpd` = ?", [user.nama_ukpd]);
  } else if (user.role === ROLES.ADMIN_WILAYAH) {
    addWhere(scopedUkpdWhere, scopedUkpdParams, "`wilayah` = ?", [user.wilayah]);
  } else if (user.role !== ROLES.SUPER_ADMIN) {
    addWhere(scopedUkpdWhere, scopedUkpdParams, "1 = 0");
  }
  const [ukpdRows] = await pool.query(
    `SELECT DISTINCT \`nama_ukpd\` FROM \`ukpd\` ${scopedUkpdWhere.length ? `WHERE ${scopedUkpdWhere.join(" AND ")}` : ""} ORDER BY \`nama_ukpd\` ASC`,
    scopedUkpdParams
  );

  return {
    rows: normalizePegawaiRows(rows),
    total: Number(countRows[0]?.total || 0),
    page,
    pageSize,
    filters: {
      ukpdOptions: ukpdRows.map((row) => row.nama_ukpd).filter(Boolean)
    }
  };
}

export async function GET(request) {
  const { user, error } = await requireAuth();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.toLowerCase() || "";
  const status = searchParams.get("status") || "";
  const wilayah = searchParams.get("wilayah") || "";
  const ukpd = searchParams.get("ukpd") || "";
  const page = numberParam(searchParams.get("page"), 1, 1, 100000);
  const pageSize = numberParam(searchParams.get("pageSize"), 10, 10, 100);
  const exportAll = searchParams.get("export") === "1";

  return ok(await getPegawaiPage({ user, q, status, wilayah, ukpd, page, pageSize, exportAll }));
}

export async function POST(request) {
  const { user, error } = await requireAuth();
  if (error) return error;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return fail("Validasi data pegawai gagal.", 422, parsed.error.flatten());

  const nextItem = { ...parsed.data };
  const photoUpload = nextItem.photo_upload;
  delete nextItem.photo_upload;
  const ukpdList = await getUkpdData();
  const allowed = filterPegawaiByRole([nextItem], user, ukpdList).length === 1;
  if (!allowed) return fail("Anda tidak boleh membuat pegawai untuk UKPD atau wilayah lain.", 403);
  const created = await createPegawaiData(nextItem);
  if (photoUpload) {
    await savePegawaiPhoto(created.id_pegawai, photoUpload);
  }
  return ok({ ...created, photo_url: await getPegawaiPhotoUrl(created.id_pegawai) }, "Pegawai berhasil ditambahkan");
}
