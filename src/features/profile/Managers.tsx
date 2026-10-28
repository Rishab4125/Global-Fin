"use client";

import { useState, useTransition } from "react";
import { DeleteButton } from "@/components/DeleteButton";
import { Field, FormError, FormNotice } from "@/components/fields";
import { useServerForm } from "@/components/useServerForm";
import { MAX_PLATFORM_LENGTH } from "@/domain/platform";
import { addPlatformAction, deleteAllDataAction, deletePlatformAction, deleteTagAction, renameTagAction } from "./actions";

export interface PlatformRow {
  name: string;
  kind: string;
  builtIn: boolean;
  /** Purchases held here. */
  uses: number;
}

const KIND_LABEL: Record<string, string> = { broker: "Broker", bank: "Bank", self: "Self / locker" };

export function PlatformManager({ rows }: { rows: PlatformRow[] }) {
  const { formRef, state, pending, onSubmit } = useServerForm(addPlatformAction, true);
  return (
    <div>
      <ul className="divide-y divide-line">
        {rows.map((p) => (
          <li key={p.name} className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="text-xs text-muted">
                {p.builtIn ? "Built in" : KIND_LABEL[p.kind] ?? p.kind} · {p.uses} purchase{p.uses === 1 ? "" : "s"}
              </p>
            </div>
            {!p.builtIn && (
              <DeleteButton
                compact
                label="Remove"
                ariaLabel={`Remove ${p.name}`}
                action={() => deletePlatformAction(p.name)}
                id={p.name}
                confirmText={`Remove ${p.name} from your list?`}
              />
            )}
          </li>
        ))}
      </ul>
      <form ref={formRef} onSubmit={onSubmit} className="space-y-3 border-t border-line p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <Field label="Add a platform">
            <input name="name" required maxLength={MAX_PLATFORM_LENGTH} autoComplete="off" placeholder="e.g. HDFC Bank, Upstox" className="input" />
          </Field>
          <Field label="Kind">
            <select name="kind" className="input" defaultValue="broker">
              <option value="broker">Broker</option>
              <option value="bank">Bank</option>
              <option value="self">Self / locker</option>
            </select>
          </Field>
          <button className="btn-primary" disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </button>
        </div>
        <FormError message={state.error} />
        <FormNotice message={state.ok ? "Platform added." : undefined} />
      </form>
    </div>
  );
}

export function TagManager({ tags }: { tags: { tag: string; uses: number }[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const save = (from: string) =>
    start(async () => {
      const fd = new FormData();
      fd.set("from", from);
      fd.set("to", value);
      const res = await renameTagAction({}, fd);
      if (res.error) setError(res.error);
      else {
        setEditing(null);
        setError(undefined);
      }
    });

  if (tags.length === 0) {
    return <p className="px-5 py-6 text-sm text-muted">No tags yet. Add tags under &quot;More details&quot; when you add an investment.</p>;
  }
  return (
    <div>
      <ul className="divide-y divide-line">
        {tags.map(({ tag, uses }) => (
          <li key={tag} className="flex items-center justify-between gap-3 px-5 py-3">
            {editing === tag ? (
              <form
                className="flex min-w-0 flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  save(tag);
                }}
              >
                <input
                  autoFocus
                  value={value}
                  maxLength={30}
                  aria-label={`New name for ${tag}`}
                  onChange={(e) => setValue(e.target.value)}
                  className="input !h-9"
                />
                <button className="btn-primary !h-9" disabled={pending}>
                  Save
                </button>
                <button type="button" className="btn-ghost !h-9" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">#{tag}</p>
                  <p className="text-xs text-muted">
                    {uses} holding{uses === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-ghost !h-8 !px-3"
                    onClick={() => {
                      setEditing(tag);
                      setValue(tag);
                      setError(undefined);
                    }}
                  >
                    Rename
                  </button>
                  <DeleteButton
                    compact
                    label="Delete"
                    ariaLabel={`Delete tag ${tag}`}
                    action={() => deleteTagAction(tag)}
                    id={tag}
                    confirmText={`Remove the tag "${tag}" from every holding?`}
                  />
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {error && <div className="px-5 pb-4"><FormError message={error} /></div>}
    </div>
  );
}

export function DeleteAllData() {
  const { formRef, state, pending, onSubmit } = useServerForm(deleteAllDataAction);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm text-muted">
        This deletes every holding, purchase, sale, event, misc entry, platform and setting stored for your account, then
        signs you out. It can&apos;t be undone. Export your data first if you may want it.
      </p>
      <Field label="Type DELETE to confirm">
        <input name="confirm" autoComplete="off" className="input max-w-xs" />
      </Field>
      <FormError message={state.error} />
      <button className="btn border border-loss/40 bg-loss/10 text-loss hover:bg-loss/20" disabled={pending}>
        {pending ? "Deleting…" : "Delete all my data"}
      </button>
    </form>
  );
}
