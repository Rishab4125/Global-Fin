import { LogOut, TrendingUp } from "lucide-react";
import { signOut } from "@/auth";
import { BottomNav, SideNav } from "@/components/Nav";
import { AccountButton, OverlayProvider } from "@/components/Overlays";
import { ThemeToggle } from "@/components/ThemeToggle";
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
  const person = { name: user.name, email: user.email, initial };

  return (
    <OverlayProvider
      user={person}
      signOutSlot={
        <form action={signOutAction}>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-loss outline-none hover:bg-surface2 focus-visible:bg-surface2">
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-loss/10">
              <LogOut size={18} />
            </span>
            Sign out
          </button>
        </form>
      }
    >
      <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
        <aside className="sticky top-0 hidden h-screen flex-col justify-between bg-sidebar p-4 text-white lg:flex">
          <div className="space-y-8">
            <div className="px-2 pt-1">
              <Logo />
            </div>
            <SideNav />
          </div>
          <div className="space-y-3">
            <ThemeToggle variant="segmented" />
            <AccountButton user={person} variant="sidebar" />
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
            <Logo />
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <AccountButton user={person} variant="avatar" />
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:py-9 lg:pb-12">
            {children}
          </main>
        </div>

        <BottomNav />
      </div>
    </OverlayProvider>
  );
}
