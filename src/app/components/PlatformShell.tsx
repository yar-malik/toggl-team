"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

function navClass(active: boolean) {
  return `block w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${
    active
      ? "border border-rose-200 bg-rose-100 text-rose-900 shadow-sm"
      : "border border-transparent text-slate-700 hover:border-sky-100 hover:bg-sky-50"
  }`;
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function PlatformShell({
  children,
  currentUserEmail,
}: {
  children: ReactNode;
  currentUserEmail: string | null;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fef7ff_0%,#f5fbff_35%,#f6fffb_100%)]">
      <div className="mx-auto flex w-full max-w-[1700px] gap-4 px-4 py-4 md:px-6">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[272px] shrink-0 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-[0_20px_40px_rgba(15,23,42,0.08)] backdrop-blur lg:flex lg:flex-col">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-rose-50 via-sky-50 to-emerald-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Voho Platform</p>
            <p className="mt-1 truncate text-sm font-medium text-slate-700">{currentUserEmail ?? "Signed in"}</p>
          </div>

          <nav className="mt-4 flex-1 space-y-2">
            <Link href="/reports" className={navClass(isActive(pathname, "/reports"))}>
              Reports
            </Link>
            <Link href="/track" className={navClass(isActive(pathname, "/track"))}>
              Tracking
            </Link>
            <Link href="/team-overview" className={navClass(isActive(pathname, "/team-overview"))}>
              Team overview
            </Link>
            <Link href="/projects" className={navClass(isActive(pathname, "/projects"))}>
              Projects
            </Link>
            <Link href="/members" className={navClass(isActive(pathname, "/members") || isActive(pathname, "/member"))}>
              Members
            </Link>
            <Link href="/kpis" className={navClass(isActive(pathname, "/kpis"))}>
              KPIs
            </Link>
          </nav>

          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
            className="mt-auto w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Sign out
          </button>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
