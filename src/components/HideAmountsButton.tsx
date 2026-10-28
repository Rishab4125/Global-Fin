"use client";

import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";

const COOKIE = "hide-amounts";

/** Eye icon that blurs every amount marked `.amt`. Remembered for a year in a cookie, so every page respects it. */
export function HideAmountsButton() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => setHidden(document.documentElement.classList.contains("hide-amounts")), []);

  const toggle = () => {
    const next = !hidden;
    document.documentElement.classList.toggle("hide-amounts", next);
    document.cookie = `${COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
    setHidden(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={hidden ? "Show amounts" : "Hide amounts"}
      title={hidden ? "Show amounts" : "Hide amounts"}
      className="grid size-9 place-items-center rounded-lg text-muted outline-none transition hover:bg-surface2 hover:text-ink focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
}
