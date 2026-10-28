"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/** A dropdown that sets one URL parameter and keeps every other one. The default value removes the parameter. */
export function ParamSelect({
  param,
  value,
  defaultValue,
  options,
  label,
}: {
  param: string;
  value: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  label: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  return (
    <select
      aria-label={label}
      value={value}
      disabled={pending}
      className="input !h-9 !w-auto min-w-0 max-w-[9.5rem] sm:max-w-none"
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        if (e.target.value === defaultValue) next.delete(param);
        else next.set(param, e.target.value);
        const qs = next.toString();
        start(() => router.replace(qs ? `${path}?${qs}` : path));
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
