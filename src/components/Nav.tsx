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
import { useEffect, useState } from "react";

interface NavLink {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
}

const links: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { href: "/holdings", label: "Holdings", short: "Holdings", icon: BriefcaseBusiness },
  { href: "/realised", label: "Realised gains", short: "Gains", icon: TrendingUp },
  { href: "/misc", label: "Misc P/L", short: "Misc", icon: PlusCircle },
  { href: "/transactions", label: "Transactions", short: "Transactions", icon: ArrowLeftRight },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings },
];

const primary = links.slice(0, 4);
const more = links.slice(4);

const isActive = (path: string, href: string) =>
  path === href || path.startsWith(href + "/") || (href === "/holdings" && path.startsWith("/sell"));

/** Top tabs: tablet/desktop only. */
export function Nav() {
  const path = usePathname();
  return (
    <nav className="hidden gap-1 md:flex">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            isActive(path, l.href)
              ? "bg-white/12 text-white shadow-[inset_0_-2px_0_var(--accent)]"
              : "text-white/80 hover:bg-white/10 hover:text-white"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

/** Bottom tab bar: phones only. Less-used pages and sign-out live under "More". */
export function BottomNav({ signOutSlot }: { signOutSlot: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [path]);

  const moreActive = more.some((l) => isActive(path, l.href));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] mx-3 rounded-2xl border border-line bg-surface p-2 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {more.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium hover:bg-surface2"
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
        className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(16,40,28,.08)] md:hidden"
      >
        <ul className="grid h-16 grid-cols-5">
          {primary.map((l) => (
            <li key={l.href}>
              <TabLink link={l} active={isActive(path, l.href)} />
            </li>
          ))}
          <li>
            <button
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className={`flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                open || moreActive ? "text-primary" : "text-muted"
              }`}
            >
              <MoreHorizontal size={22} />
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
      className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
        active ? "text-primary" : "text-muted"
      }`}
    >
      <span className={`rounded-full px-4 py-0.5 ${active ? "bg-primary-soft" : ""}`}>
        <link.icon size={22} />
      </span>
      {link.short}
    </Link>
  );
}
