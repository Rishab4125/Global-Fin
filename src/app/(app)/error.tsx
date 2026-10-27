"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { EmptyState } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card">
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong"
        text="We couldn't load this page. Your data is safe. Try again, and if it keeps happening, sign out and back in."
        action={
          <button type="button" className="btn-primary" onClick={reset}>
            Try again
          </button>
        }
      />
    </div>
  );
}
