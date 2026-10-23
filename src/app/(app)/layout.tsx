import { LogOut, TrendingUp } from "lucide-react";
import { signOut } from "@/auth";
import { BottomNav, SideNav } from "@/components/Nav";
import { requireUser } from "@/features/auth/session";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-700 text-white shadow-sm">
        <TrendingUp size={17} strokeWidth={2.5} />
      </span>
      <span className="text-[17px] font-semibold tracking-tight">Global Fin</span>
    </div>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const display = user.name || user.email;
  const initial = display.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col justify-between bg-sidebar p-4 text-white lg:flex">
        <div className="space-y-8">
          <div className="px-2 pt-1">
            <Logo />
          </div>
          <SideNav />
        </div>
        <form action={signOutAction} className="flex items-center gap-3 rounded-xl bg-white/6 p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-semibold">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name || "Account"}</p>
            <p className="truncate text-xs text-white/50">{user.email}</p>
          </div>
          <button aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white">
            <LogOut size={17} />
          </button>
        </form>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
          <Logo />
          <span className="grid size-8 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary-strong">
            {initial}
          </span>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:py-9 lg:pb-12">
          {children}
        </main>
      </div>

      <BottomNav
        signOutSlot={
          <form action={signOutAction}>
            <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium text-loss hover:bg-surface2">
              <LogOut size={20} />
              Sign out
            </button>
          </form>
        }
      />
    </div>
  );
}
