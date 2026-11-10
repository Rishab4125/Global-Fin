"use client";

import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";

const COOKIE = "hide-amt";

/**
 * Eye icon that blurs every amount marked `.amt`. The choice is kept for a year in a cookie, so every page respects it.
 * On a page that hides its own amounts when it is refreshed, pass that page's root id: hiding then affects that page
 * alone, while showing clears the page and the saved choice.
 */
export function HideAmountsButton({ localRootId }: { localRootId?: string }) {
  const [hidden, setHidden] = useState(false);

  const root = () => (localRootId ? document.getElementById(localRootId) : null);
  const isHidden = () => document.documentElement.classList.contains("hide-amounts") || !!root()?.classList.contains("hide-home");

  useEffect(() => setHidden(isHidden()), []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    if (isHidden()) {
      document.documentElement.classList.remove("hide-amounts");
      root()?.classList.remove("hide-home");
      document.cookie = `${COOKIE}=0; path=/; max-age=31536000; samesite=lax`;
      setHidden(false);
    } else if (localRootId) {
      root()?.classList.add("hide-home");
      setHidden(true);
    } else {
      document.documentElement.classList.add("hide-amounts");
      document.cookie = `${COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
      setHidden(true);
    }
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
