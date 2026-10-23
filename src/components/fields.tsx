import { ASSET_RULES, ASSET_TYPE_IDS, type AssetTypeId } from "@/domain/taxRules";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function AssetTypeSelect({
  name = "type",
  defaultValue = "equity",
  onChange,
}: {
  name?: string;
  defaultValue?: AssetTypeId;
  onChange?: (value: AssetTypeId) => void;
}) {
  const groups = new Map<string, AssetTypeId[]>();
  for (const id of ASSET_TYPE_IDS) {
    const g = ASSET_RULES[id].group;
    groups.set(g, [...(groups.get(g) ?? []), id]);
  }
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="input"
      onChange={onChange ? (e) => onChange(e.target.value as AssetTypeId) : undefined}
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
    </select>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-loss/10 px-3 py-2 text-sm text-loss">
      {message}
    </p>
  );
}

export function YesNo({ name, defaultValue = "yes" }: { name: string; defaultValue?: "yes" | "no" }) {
  return (
    <div className="flex gap-4 py-2 text-sm">
      {(["yes", "no"] as const).map((v) => (
        <label key={v} className="flex items-center gap-2">
          <input type="radio" name={name} value={v} defaultChecked={defaultValue === v} className="accent-[var(--primary)]" />
          {v === "yes" ? "Yes" : "No"}
        </label>
      ))}
    </div>
  );
}
