"use client";

import Link from "next/link";
import { Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import RoleBadge from "@/components/ui/RoleBadge";

export default function Topbar({ user, onOpenMenu, collapsed, onToggleSidebar }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 focus-ring lg:hidden" onClick={onOpenMenu} aria-label="Buka menu">
            <Menu className="h-5 w-5" />
          </button>
          <button className="hidden rounded-xl p-2 text-slate-600 hover:bg-slate-100 focus-ring lg:inline-flex" onClick={onToggleSidebar} aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"}>
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
          <label className="relative hidden w-80 md:block">
            <span className="sr-only">Pencarian cepat</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input py-2 pl-9" placeholder="Cari pegawai atau UKPD" />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/profil" className="btn-secondary hidden py-2 sm:inline-flex">
            Lihat Profil
          </Link>
          <RoleBadge role={user?.role} />
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-slate-900">{user?.username}</p>
            <p className="max-w-52 truncate text-xs text-slate-500">{user?.nama_ukpd}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
