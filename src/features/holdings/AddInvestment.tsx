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
          <div className="flex flex-wrap gap-2">
            <button type="button" className={open ? "btn-ghost" : "btn-primary"} onClick={() => setOpen((o) => !o)}>
              {open ? <X size={16} /> : <Plus size={16} />}
              {open ? "Close" : "Add investment"}
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
