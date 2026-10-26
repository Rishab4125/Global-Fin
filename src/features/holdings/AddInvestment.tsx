"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/ui";
import { AddBuyForm } from "./AddBuyForm";

/** Page header with an Add investment button (left of the other actions) that reveals the form, then the filters. */
export function AddInvestment({
  today,
  title,
  description,
  actions,
  children,
}: {
  today: string;
  title: string;
  description: string;
  actions: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              aria-label={open ? "Close" : "Add investment"}
              title={open ? "Close" : "Add investment"}
              className={`${open ? "btn-ghost" : "btn-primary"} shrink-0 max-sm:!w-10 max-sm:!min-w-10 max-sm:!px-0`}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <X size={16} /> : <Plus size={16} />}
              <span className="hidden sm:inline">{open ? "Close" : "Add investment"}</span>
            </button>
            {actions}
          </div>
        }
      />
      {open && (
        <div className="mb-5">
          <AddBuyForm today={today} />
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">{children}</div>
    </>
  );
}
