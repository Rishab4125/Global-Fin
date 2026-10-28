"use client";

import { usePathname } from "next/navigation";
import { SegmentLinks } from "@/components/SegmentLinks";
import { ACCOUNT_ITEMS } from "@/components/accountMenu";

const SHORT: Record<string, string> = {
  "/profile": "Profile",
  "/profile/tax": "Tax",
  "/profile/platforms": "Connected",
  "/profile/tags": "Platforms & tags",
  "/profile/preferences": "Preferences",
  "/profile/data": "Data",
  "/profile/about": "About",
};

export function ProfileTabs() {
  const path = usePathname();
  return (
    <SegmentLinks
      label="Account sections"
      items={ACCOUNT_ITEMS.map((i) => ({ href: i.href, label: SHORT[i.href] ?? i.label, active: path === i.href }))}
    />
  );
}
