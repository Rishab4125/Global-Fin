import { LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { BottomNav, Nav } from "@/components/Nav";
import { requireUser } from "@/features/auth/session";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <header style={{ background: "var(--sunset)" }} className="text-white shadow">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <span className="text-lg font-bold tracking-tight">Global Fin</span>
          <Nav />
          <form action={signOutAction} className="hidden items-center gap-3 text-sm md:flex">
            <span className="text-white/80">{user.name || user.email}</span>
            <button className="rounded-lg border border-white/40 px-3 py-1 text-sm hover:bg-white/10">
              Sign out
            </button>
          </form>
          <span className="truncate text-sm text-white/80 md:hidden">{user.name || user.email}</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:py-6 md:pb-6">
        {children}
      </main>
      <BottomNav
        signOutSlot={
          <form action={signOutAction}>
            <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-loss hover:bg-surface2">
              <LogOut size={20} />
              Sign out
            </button>
          </form>
        }
      />
    </div>
  );
}
