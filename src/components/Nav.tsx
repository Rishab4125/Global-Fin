"use client";

import {
  ArrowLeftRight,
  BriefcaseBusiness,
  LayoutDashboard,
  Plus,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOverlays } from "@/components/Overlays";

interface NavLink {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
}

const dashboard: NavLink = { href: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard };
const holdings: NavLink = { href: "/holdings", label: "Holdings", short: "Holdings", icon: BriefcaseBusiness };
const transactions: NavLink = { href: "/transactions", label: "Transactions", short: "Activity", icon: ArrowLeftRight };
const gains: NavLink = { href: "/gains", label: "Gains", short: "Gains", icon: TrendingUp };

const sections: { title: string; links: NavLink[] }[] = [
  { title: "Overview", links: [dashboard] },
  { title: "Portfolio", links: [holdings, transactions] },
  { title: "Reports", links: [gains] },
];

/** Selling happens from a holding, and Misc is part of Gains, so those paths keep their parent tab lit. */
const isActive = (path: string, href: string) =>
  path === href || path.startsWith(href + "/") || (href === "/holdings" && path.startsWith("/sell"));

/** Desktop sidebar navigation, with the Add button under it. */
export function SideNav() {
  const path = usePathname();
  const { openAdd } = useOverlays();
  return (
    <nav aria-label="Primary" className="flex flex-col gap-5">
      {sections.map((s) => (
        <div key={s.title}>
          <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-[0.04em] text-white/60">{s.title}</p>
          <ul className="space-y-0.5">
            {s.links.map((l) => {
              const active = isActive(path, l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-300/70 ${
                      active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/7 hover:text-white"
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
      <button
        type="button"
        onClick={openAdd}
        aria-haspopup="dialog"
        className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-[#04130c] outline-none transition hover:bg-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-200"
      >
        <Plus size={18} />
        Add
      </button>
    </nav>
  );
}

/** Bottom tab bar for phones and tablets: Home, Holdings, Add, Activity, Gains. */
export function BottomNav() {
  const path = usePathname();
  const { openAdd } = useOverlays();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        <li>
          <TabLink link={dashboard} active={isActive(path, dashboard.href)} />
        </li>
        <li>
          <TabLink link={holdings} active={isActive(path, holdings.href)} />
        </li>
        <li>
          <button
            type="button"
            onClick={openAdd}
            aria-haspopup="dialog"
            className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted outline-none focus-visible:bg-surface2"
          >
            <span className="rounded-full bg-primary px-[18px] py-1.5 text-[var(--on-primary)]">
              <Plus size={20} />
            </span>
            Add
          </button>
        </li>
        <li>
          <TabLink link={transactions} active={isActive(path, transactions.href)} />
        </li>
        <li>
          <TabLink link={gains} active={isActive(path, gains.href)} />
        </li>
      </ul>
    </nav>
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
