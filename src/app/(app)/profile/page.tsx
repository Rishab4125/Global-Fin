import { PageHeader, SectionCard } from "@/components/ui";
import { requireUser } from "@/features/auth/session";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase() || "U";
  return (
    <div>
      <PageHeader title="Profile" description="Your details come from your Google account." />
      <div className="space-y-5">
        <SectionCard>
          <div className="flex items-center gap-4">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" referrerPolicy="no-referrer" className="size-16 rounded-full" />
            ) : (
              <span className="grid size-16 place-items-center rounded-full bg-primary-soft text-xl font-semibold text-primary-strong">
                {initial}
              </span>
            )}
            <div className="min-w-0">
              <p className="t-title truncate">{user.name || "Account"}</p>
              <p className="t-body truncate text-muted">{user.email}</p>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Account" description="Your data is stored against this Google account ID.">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="kpi-label">Signed in as</dt>
              <dd className="mt-1 break-all font-medium">{user.email || user.name}</dd>
            </div>
            <div>
              <dt className="kpi-label">Account ID</dt>
              <dd className="mt-1 break-all font-mono text-xs">{user.id}</dd>
            </div>
          </dl>
        </SectionCard>
      </div>
    </div>
  );
}
