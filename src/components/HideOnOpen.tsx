"use client";

import { useEffect } from "react";

/**
 * Opens the page with amounts hidden. The server marks the page root `hide-amounts` so nothing is ever shown before
 * this runs; this then turns the global switch on (and remembers it), so the eye icon and every other page agree.
 * Showing amounts afterwards is the eye icon's job.
 */
export function HideOnOpen({ rootId }: { rootId: string }) {
  useEffect(() => {
    document.documentElement.classList.add("hide-amounts");
    document.cookie = "hide-amounts=1; path=/; max-age=31536000; samesite=lax";
    document.getElementById(rootId)?.classList.remove("hide-amounts");
  }, [rootId]);
  return null;
}
