import { Database, Info, Link2, SlidersHorizontal, Tags, User, Receipt, type LucideIcon } from "lucide-react";

export interface AccountItem {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}

/** The account menu and the Profile section's tabs. Settings no longer has a page of its own. */
export const ACCOUNT_ITEMS: AccountItem[] = [
  { href: "/profile", label: "Profile", hint: "Name, photo and email", icon: User },
  { href: "/profile/tax", label: "Tax settings", hint: "Slab rate and the rules applied", icon: Receipt },
  { href: "/profile/platforms", label: "Connected platforms", hint: "Zerodha Kite, imports and sync", icon: Link2 },
  { href: "/profile/tags", label: "Platforms and tags", hint: "Manage where you hold things and your tags", icon: Tags },
  { href: "/profile/preferences", label: "Preferences", hint: "Theme and how numbers are shown", icon: SlidersHorizontal },
  { href: "/profile/data", label: "Data", hint: "Export, import and delete", icon: Database },
  { href: "/profile/about", label: "About", hint: "Version, disclaimer and privacy", icon: Info },
];
