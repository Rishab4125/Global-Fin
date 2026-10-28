"use client";

import { useState } from "react";
import { MAX_PLATFORM_LENGTH } from "@/domain/platform";

const NEW = "__new__";

/** Where an investment is held: pick one of the user's platforms or type a new one. Submits as `platform`. */
export function PlatformField({
  platforms,
  defaultValue,
  label = "Where is it held",
  hint,
}: {
  platforms: string[];
  defaultValue: string;
  label?: string;
  hint?: string;
}) {
  const known = platforms.includes(defaultValue) ? defaultValue : platforms[0];
  const [choice, setChoice] = useState(known);
  const [custom, setCustom] = useState("");
  const adding = choice === NEW;

  return (
    <div>
      <label className="block">
        <span className="label">{label}</span>
        <select value={choice} onChange={(e) => setChoice(e.target.value)} className="input">
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value={NEW}>+ Add new…</option>
        </select>
      </label>
      {adding && (
        <input
          autoFocus
          required
          maxLength={MAX_PLATFORM_LENGTH}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="e.g. HDFC Bank, Upstox, Locker"
          aria-label="New platform name"
          className="input mt-2"
        />
      )}
      <input type="hidden" name="platform" value={adding ? custom.trim() : choice} />
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </div>
  );
}
