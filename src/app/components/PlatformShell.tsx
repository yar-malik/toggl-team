"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

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

function formatTimer(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildTimerFaviconDataUrl(label: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.fillStyle = "#111827";
  context.fillRect(0, 0, 64, 64);
  context.fillStyle = "#ffffff";
  context.font = "bold 10px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, 32, 34);
  return canvas.toDataURL("image/png");
}

function setFaviconHref(href: string) {
  let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;
}

export default function PlatformShell({
  children,
  currentUserEmail,
}: {
  children: ReactNode;
  currentUserEmail: string | null;
}) {
  const pathname = usePathname();
  const [memberName, setMemberName] = useState<string | null>(null);
  const [timerStartAt, setTimerStartAt] = useState<string | null>(null);
  const [fallbackDurationSeconds, setFallbackDurationSeconds] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  const defaultTitleRef = useRef("Voho Platform");
  const defaultFaviconHrefRef = useRef("/favicon.ico");

  useEffect(() => {
    defaultTitleRef.current = document.title || "Voho Platform";
    const existingIcon = (document.querySelector("link[rel='icon']") as HTMLLinkElement | null)?.href;
    if (existingIcon) defaultFaviconHrefRef.current = existingIcon;
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const userEmail = currentUserEmail?.trim().toLowerCase() ?? "";
    if (!userEmail) return;

    async function loadTimerState() {
      try {
        const membersResponse = await fetch("/api/members?_req=" + Date.now(), { cache: "no-store" });
        const membersData = (await membersResponse.json()) as {
          members?: Array<{ name: string; email?: string | null }>;
          error?: string;
        };
        if (!membersResponse.ok || membersData.error) return;

        const matchedMember =
          membersData.members?.find(
            (member) => (member.email ?? "").trim().toLowerCase() === userEmail
          ) ?? null;
        if (!matchedMember) {
          if (!active) return;
          setMemberName(null);
          setTimerStartAt(null);
          setFallbackDurationSeconds(0);
          return;
        }

        if (!active) return;
        setMemberName(matchedMember.name);

        const currentResponse = await fetch(
          `/api/time-entries/current?member=${encodeURIComponent(matchedMember.name)}&_req=${Date.now()}`,
          { cache: "no-store" }
        );
        const currentData = (await currentResponse.json()) as {
          current?: { startAt: string; durationSeconds: number } | null;
          error?: string;
        };
        if (!currentResponse.ok || currentData.error || !active) return;
        setTimerStartAt(currentData.current?.startAt ?? null);
        setFallbackDurationSeconds(currentData.current?.durationSeconds ?? 0);
      } catch {
        // Keep last known timer state on polling errors.
      }
    }

    void loadTimerState();
    const refreshInterval = window.setInterval(() => void loadTimerState(), 60 * 1000);
    const onFocus = () => void loadTimerState();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", onFocus);
    };
  }, [currentUserEmail]);

  const runningSeconds = useMemo(() => {
    if (!timerStartAt) return 0;
    const startedAtMs = new Date(timerStartAt).getTime();
    if (Number.isNaN(startedAtMs)) return Math.max(0, fallbackDurationSeconds);
    return Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  }, [timerStartAt, fallbackDurationSeconds, nowMs]);
  const runningLabel = useMemo(() => formatTimer(runningSeconds), [runningSeconds]);
  const isRunning = Boolean(timerStartAt);

  useEffect(() => {
    if (!isRunning) {
      document.title = defaultTitleRef.current;
      setFaviconHref(defaultFaviconHrefRef.current);
      return;
    }
    document.title = `${runningLabel} • ${defaultTitleRef.current}`;
    const faviconDataUrl = buildTimerFaviconDataUrl(runningLabel);
    if (faviconDataUrl) setFaviconHref(faviconDataUrl);
  }, [isRunning, runningLabel]);

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
              {isRunning && memberName ? (
                <span className="tabular-nums">
                  {runningLabel}
                </span>
              ) : (
                "Tracking"
              )}
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
