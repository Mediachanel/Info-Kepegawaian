import { redirect } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import RoleBadge from "@/components/ui/RoleBadge";
import { getCurrentUser } from "@/lib/auth/session";

export default async function ProfilPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <PageHeader title="Profil Akun" description="Informasi sesi pengguna yang sedang aktif." breadcrumbs={[{ label: "Profil Akun" }]} />
      <section className="surface max-w-2xl p-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="label">Username</dt><dd className="mt-1 text-sm text-slate-800">{user.username}</dd></div>
          <div><dt className="label">Role</dt><dd className="mt-1"><RoleBadge role={user.role} /></dd></div>
          <div><dt className="label">UKPD</dt><dd className="mt-1 text-sm text-slate-800">{user.nama_ukpd}</dd></div>
          <div><dt className="label">Wilayah</dt><dd className="mt-1 text-sm text-slate-800">{user.wilayah}</dd></div>
        </dl>
      </section>
    </>
  );
}
