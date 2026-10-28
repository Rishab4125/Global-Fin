"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/ui";
import { MiscForm } from "./MiscForm";

/** Page header with an Add misc P/L button that reveals the form, then the filters. */
export function AddMisc({
  today,
  title,
  description,
  tabs,
  defaultOpen = false,
  children,
}: {
  today: string;
  title: string;
  description: string;
  /** Segment links shown between the header and the form. */
  tabs?: React.ReactNode;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const label = open ? "Close" : "Add misc P/L";
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <button
            type="button"
            aria-label={label}
            title={label}
            className={`${open ? "btn-ghost" : "btn-primary"} shrink-0 max-sm:!w-10 max-sm:!min-w-10 max-sm:!px-0`}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={16} /> : <Plus size={16} />}
            <span className="hidden sm:inline">{label}</span>
          </button>
        }
      />
      {tabs}
      {open && (
        <div className="mb-5">
          <MiscForm today={today} />
        </div>
      )}
      {children && <div className="mb-4 flex flex-wrap items-center gap-3">{children}</div>}
    </>
  );
}
