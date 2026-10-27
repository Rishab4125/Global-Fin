import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-6">
      <div className="card w-full">
        <EmptyState
          icon={SearchX}
          title="We couldn't find that"
          text="The page or holding you opened doesn't exist, or it was deleted."
          action={
            <Link href="/dashboard" className="btn-primary">
              Go to dashboard
            </Link>
          }
        />
      </div>
    </main>
  );
}
