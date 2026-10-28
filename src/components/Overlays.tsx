"use client";

import { ClipboardPlus, MoreHorizontal, Plus, RefreshCw, TrendingDown, Upload, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ACCOUNT_ITEMS } from "@/components/accountMenu";

type Overlay = "add" | "account" | null;

interface Api {
  openAdd: () => void;
  toggleAccount: () => void;
}

const Ctx = createContext<Api>({ openAdd: () => {}, toggleAccount: () => {} });
export const useOverlays = () => useContext(Ctx);

export interface OverlayUser {
  name: string;
  email: string;
  initial: string;
}

const ADD_ITEMS: { href: string; label: string; hint: string; icon: LucideIcon }[] = [
  { href: "/holdings?add=1", label: "Add investment", hint: "Something you bought elsewhere", icon: Plus },
  { href: "/sell", label: "Add sale", hint: "Record a sale that already happened", icon: TrendingDown },
  { href: "/gains/misc?add=1", label: "Add misc / dividend", hint: "F&O, interest or other. Dividends: open the holding", icon: ClipboardPlus },
  { href: "/holdings/import", label: "Import trades", hint: "Zerodha or Groww reports", icon: Upload },
  { href: "/holdings/sync", label: "Sync", hint: "Pull holdings from Zerodha Kite", icon: RefreshCw },
];

/**
 * Holds the Add sheet and the account menu so any button in the sidebar, header or bottom bar can open them.
 * On a phone both are bottom sheets; on a desktop the Add sheet is a dialog and the account menu a popover.
 */
export function OverlayProvider({
  user,
  signOutSlot,
  children,
}: {
  user: OverlayUser;
  signOutSlot: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState<Overlay>(null);
  const path = usePathname();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  const show = useCallback((o: Exclude<Overlay, null>) => {
    opener.current = document.activeElement;
    setOpen(o);
  }, []);
  const close = useCallback(() => {
    setOpen(null);
    (opener.current as HTMLElement | null)?.focus?.();
  }, []);

  // Moving to another page closes whatever is open.
  useEffect(() => setOpen(null), [path]);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key !== "Tab" || !panel.current) return;
      // Keep Tab inside the open panel.
      const items = [...panel.current.querySelectorAll<HTMLElement>("a, button")];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const api = useMemo<Api>(
    () => ({ openAdd: () => show("add"), toggleAccount: () => (open === "account" ? close() : show("account")) }),
    [show, close, open],
  );

  const sheet =
    "fixed z-[75] inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-line bg-surface p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-xl";

  return (
    <Ctx.Provider value={api}>
      {children}
      {open && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/45" aria-hidden onClick={close} />
          {open === "add" ? (
            <div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-label="Add"
              className={`${sheet} lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:w-[480px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl`}
            >
              <h2 className="t-title px-3 pb-2 pt-1">Add</h2>
              {ADD_ITEMS.map((i) => (
                <MenuLink key={i.href} href={i.href} label={i.label} hint={i.hint} icon={i.icon} />
              ))}
            </div>
          ) : (
            <div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-label="Account"
              className={`${sheet} lg:inset-x-auto lg:bottom-20 lg:left-4 lg:w-72 lg:rounded-2xl`}
            >
              <div className="flex items-center gap-3 px-3 pb-3 pt-1">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary-strong">
                  {user.initial}
                </span>
                <div className="min-w-0">
                  <p className="t-body-strong truncate">{user.name || "Account"}</p>
                  <p className="t-caption truncate">{user.email}</p>
                </div>
              </div>
              {ACCOUNT_ITEMS.map((i) => (
                <MenuLink key={i.href} href={i.href} label={i.label} hint={i.hint} icon={i.icon} />
              ))}
              <div className="mt-1 border-t border-line pt-1">{signOutSlot}</div>
            </div>
          )}
        </>
      )}
    </Ctx.Provider>
  );
}

function MenuLink({ href, label, hint, icon: Icon }: { href: string; label: string; hint: string; icon: LucideIcon }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 outline-none hover:bg-surface2 focus-visible:bg-surface2"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary-soft text-primary">
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="t-body-strong block">{label}</span>
        <span className="t-caption block">{hint}</span>
      </span>
    </Link>
  );
}

/** The avatar in the mobile header and the user box in the sidebar. */
export function AccountButton({ user, variant }: { user: OverlayUser; variant: "avatar" | "sidebar" }) {
  const { toggleAccount } = useOverlays();
  if (variant === "avatar") {
    return (
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="dialog"
        onClick={toggleAccount}
        className="grid size-8 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary-strong"
      >
        {user.initial}
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-label="Account menu"
      aria-haspopup="dialog"
      onClick={toggleAccount}
      className="flex w-full items-center gap-3 rounded-xl bg-white/6 p-3 text-left outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-emerald-300/70"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-semibold">{user.initial}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{user.name || "Account"}</span>
        <span className="block truncate text-xs text-white/60">{user.email}</span>
      </span>
      <MoreHorizontal size={18} className="shrink-0 text-white/60" aria-hidden />
    </button>
  );
}
