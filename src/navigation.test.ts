import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import { ACCOUNT_ITEMS } from "./components/accountMenu";

const pageFor = (path: string) => `src/app/(app)${path === "/" ? "" : path}/page.tsx`;

describe("old addresses redirect to where the content moved", () => {
  it("lists the moved routes", async () => {
    const r = await nextConfig.redirects!();
    const map = Object.fromEntries(r.map((x) => [x.source, x.destination]));
    expect(map).toEqual({
      "/realised": "/gains/sales",
      "/realised/export": "/gains/export",
      "/misc": "/gains/misc",
      "/settings": "/profile/tax",
    });
  });

  it("never redirects to a page that does not exist", async () => {
    const r = await nextConfig.redirects!();
    for (const x of r) {
      if (x.destination.endsWith("/export")) expect(existsSync(`src/app/(app)${x.destination}/route.ts`)).toBe(true);
      else expect(existsSync(pageFor(x.destination))).toBe(true);
    }
  });

  it("uses temporary redirects so the old links can still be changed later", async () => {
    const r = await nextConfig.redirects!();
    expect(r.every((x) => "permanent" in x && x.permanent === false)).toBe(true);
  });
});

describe("account menu", () => {
  it("links only to Profile pages that exist, each once", () => {
    const hrefs = ACCOUNT_ITEMS.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const h of hrefs) {
      expect(h.startsWith("/profile")).toBe(true);
      expect(existsSync(pageFor(h))).toBe(true);
    }
  });

  it("has the sections the PRD lists", () => {
    expect(ACCOUNT_ITEMS.map((i) => i.label)).toEqual([
      "Profile",
      "Tax settings",
      "Connected platforms",
      "Platforms and tags",
      "Preferences",
      "Data",
      "About",
    ]);
  });
});

describe("primary pages exist", () => {
  it.each(["/dashboard", "/holdings", "/transactions", "/gains", "/gains/sales", "/gains/misc", "/sell", "/holdings/import", "/holdings/sync"])(
    "%s",
    (p) => expect(existsSync(pageFor(p))).toBe(true),
  );

  it("the old Misc, Realised and Settings pages are gone", () => {
    for (const p of ["/misc", "/realised", "/settings"]) expect(existsSync(pageFor(p))).toBe(false);
  });
});
