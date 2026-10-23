import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "var(--sunset)" }}
    >
      <div className="card w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-primary-strong">Global Fin</h1>
        <p className="mt-2 text-sm text-muted">
          Track every investment and see your realised gains after Indian tax.
        </p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button className="btn-primary w-full">Sign in with Google</button>
        </form>
      </div>
    </div>
  );
}
