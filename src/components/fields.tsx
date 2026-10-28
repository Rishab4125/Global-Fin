import { ASSET_RULES, ASSET_TYPE_IDS, type AssetTypeId } from "@/domain/taxRules";

export function Field({
  label,
  children,
  hint,
  group = false,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  /** For radio groups: renders a labelled group instead of a <label>, which can't contain several inputs. */
  group?: boolean;
}) {
  if (group) {
    return (
      <div role="radiogroup" aria-label={label}>
        <span className="label">{label}</span>
        {children}
        {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
      </div>
    );
  }
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function AssetTypeSelect({
  name = "type",
  defaultValue = "equity",
  onChange,
  includeBuyback = false,
}: {
  name?: string;
  defaultValue?: AssetTypeId;
  onChange?: (value: string) => void;
  /** Adds "Share buyback" (used by Misc P/L only). */
  includeBuyback?: boolean;
}) {
  const groups = new Map<string, AssetTypeId[]>();
  for (const id of ASSET_TYPE_IDS) {
    const g = ASSET_RULES[id].category;
    groups.set(g, [...(groups.get(g) ?? []), id]);
  }
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="input"
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
    >
      {[...groups.entries()].map(([group, ids]) => (
        <optgroup key={group} label={group}>
          {ids.map((id) => (
            <option key={id} value={id}>
              {ASSET_RULES[id].label}
            </option>
          ))}
        </optgroup>
      ))}
      {includeBuyback && (
        <optgroup label="Corporate action">
          <option value="buyback">Share buyback</option>
        </optgroup>
      )}
    </select>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-loss/25 bg-loss/10 px-3 py-2.5 text-sm text-loss">
      {message}
    </p>
  );
}

/** Polite confirmation message, e.g. after a save. Screen readers announce it when it appears. */
export function FormNotice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="status" className="rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary-strong">
      {message}
    </p>
  );
}

export function YesNo({ name, defaultValue = "yes" }: { name: string; defaultValue?: "yes" | "no" }) {
  return (
    <div className="flex h-10 items-center gap-5 text-sm">
      {(["yes", "no"] as const).map((v) => (
        <label key={v} className="flex items-center gap-2">
          <input type="radio" name={name} value={v} defaultChecked={defaultValue === v} className="size-4 accent-[var(--primary)]" />
          {v === "yes" ? "Yes" : "No"}
        </label>
      ))}
    </div>
  );
}
