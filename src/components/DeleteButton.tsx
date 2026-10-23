"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import type { ActionState } from "@/features/portfolio/actionState";

export function DeleteButton({
  action,
  id,
  confirmText,
  label = "Delete",
  compact = false,
}: {
  action: (id: string) => Promise<ActionState>;
  id: string;
  confirmText: string;
  label?: string;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(confirmText)) return;
          setError(undefined);
          start(async () => {
            const res = await action(id);
            if (res?.error) setError(res.error);
          });
        }}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-loss/30 text-sm font-medium text-loss transition hover:bg-loss/10 disabled:opacity-60 ${
          compact ? "h-8 px-2.5" : "h-10 px-4"
        }`}
      >
        <Trash2 size={15} />
        {pending ? "Deleting…" : label}
      </button>
      {error && <span className="mt-1 max-w-56 whitespace-normal text-right text-xs text-loss">{error}</span>}
    </span>
  );
}
