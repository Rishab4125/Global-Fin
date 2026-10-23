import { Calculator, LineChart, ShieldCheck, TrendingUp } from "lucide-react";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { ThemeToggle } from "@/components/ThemeToggle";

const points = [
  { icon: LineChart, title: "Every asset in one place", text: "Stocks, funds, bonds, FDs, land, gold and crypto." },
  { icon: Calculator, title: "Indian capital-gains tax built in", text: "Short and long term rules, FIFO matching and exemptions." },
  { icon: ShieldCheck, title: "Private to you", text: "Sign in with Google. Your data is only visible to your account." },
];

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ background: "var(--sunset)" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-white/15">
            <TrendingUp size={19} strokeWidth={2.5} />
          </span>
          <span className="text-lg font-semibold tracking-tight">Global Fin</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Know what you really earned, after tax.
          </h2>
          <ul className="mt-10 space-y-6">
            {points.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10">
                  <p.icon size={19} />
                </span>
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-sm text-white/65">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/40">Estimates only. Not tax advice.</p>
      </div>

      <div className="relative flex items-center justify-center bg-bg px-6 py-12">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-(--on-primary)">
              <TrendingUp size={19} strokeWidth={2.5} />
            </span>
            <span className="text-lg font-semibold tracking-tight">Global Fin</span>
          </div>
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted">Sign in to track your investments and realised gains.</p>
          <form
            className="mt-8"
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <button className="btn-ghost h-11 w-full gap-3 text-[15px] font-medium shadow-sm">
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
                <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
                <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-4.9 2.3-8.2 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
              </svg>
              Continue with Google
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-muted">
            By continuing you agree that tax figures are estimates, not advice.
          </p>
          <p className="mt-10 text-center text-xs text-muted">
            Created by <span className="font-medium text-ink">Rishab Gupta</span>
          </p>
        </div>
      </div>
    </div>
  );
}
