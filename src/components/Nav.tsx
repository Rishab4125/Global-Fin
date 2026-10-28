"use client";

import {
  ArrowLeftRight,
  BriefcaseBusiness,
  LayoutDashboard,
  MoreHorizontal,
  PlusCircle,
  Settings,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface NavLink {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
}

const dashboard: NavLink = { href: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard };
const holdings: NavLink = { href: "/holdings", label: "Holdings", short: "Holdings", icon: BriefcaseBusiness };
const transactions: NavLink = { href: "/transactions", label: "Transactions", short: "Activity", icon: ArrowLeftRight };
const realised: NavLink = { href: "/realised", label: "Realised gains", short: "Gains", icon: TrendingUp };
const misc: NavLink = { href: "/misc", label: "Misc P/L", short: "Misc", icon: PlusCircle };
const settings: NavLink = { href: "/settings", label: "Settings", short: "Settings", icon: Settings };

const sections: { title: string; links: NavLink[] }[] = [
  { title: "Overview", links: [dashboard] },
  { title: "Portfolio", links: [holdings, misc, transactions] },
  { title: "Reports", links: [realised] },
  { title: "Account", links: [settings] },
];

const primary = [dashboard, holdings, realised, misc];
const more = [transactions, settings];

const isActive = (path: string, href: string) =>
  path === href || path.startsWith(href + "/") || (href === "/holdings" && path.startsWith("/sell"));

/** Desktop sidebar navigation. */
export function SideNav() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-5">
      {sections.map((s) => (
        <div key={s.title}>
          <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wider text-white/60">{s.title}</p>
          <ul className="space-y-0.5">
            {s.links.map((l) => {
              const active = isActive(path, l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-300/70 ${
                      active
                        ? "bg-white/12 text-white"
                        : "text-white/70 hover:bg-white/7 hover:text-white"
                    }`}
                  >
                    <l.icon size={18} className={active ? "text-emerald-300" : ""} />
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Bottom tab bar for phones and tablets. Less-used pages and sign-out live under "More". */
export function BottomNav({ signOutSlot }: { signOutSlot: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [path]);

  const moreBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      moreBtn.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const moreActive = more.some((l) => isActive(path, l.href));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            role="dialog"
            aria-label="More pages"
            className="absolute inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] mx-3 rounded-2xl border border-line bg-surface p-2 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {more.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium outline-none hover:bg-surface2 focus-visible:bg-surface2"
              >
                <l.icon size={20} className="text-primary" />
                {l.label}
              </Link>
            ))}
            <div className="mt-1 border-t border-line pt-1">{signOutSlot}</div>
          </div>
        </div>
      )}

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="grid h-16 grid-cols-5">
          {primary.map((l) => (
            <li key={l.href}>
              <TabLink link={l} active={isActive(path, l.href)} />
            </li>
          ))}
          <li>
            <button
              ref={moreBtn}
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-haspopup="dialog"
              className={`flex h-full w-full flex-col items-center justify-center gap-0.5 text-xs font-medium outline-none focus-visible:bg-surface2 ${
                open || moreActive ? "text-primary" : "text-muted"
              }`}
            >
              <span className={`rounded-full px-4 py-1 ${open || moreActive ? "bg-primary-soft" : ""}`}>
                <MoreHorizontal size={20} />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

function TabLink({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={`flex h-full flex-col items-center justify-center gap-0.5 text-xs font-medium outline-none focus-visible:bg-surface2 ${
        active ? "text-primary" : "text-muted"
      }`}
    >
      <span className={`rounded-full px-4 py-1 ${active ? "bg-primary-soft" : ""}`}>
        <link.icon size={20} />
      </span>
      {link.short}
    </Link>
  );
}
