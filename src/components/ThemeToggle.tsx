"use client";

import { Moon, Sun, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const options: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const systemTheme = (): Theme => (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

/**
 * Starts from the device setting. Once the user picks a theme it is saved and used instead.
 */
function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      setSaved(true);
    } else {
      setTheme(systemTheme());
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (saved) return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(systemTheme());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [saved]);

  const choose = (t: Theme) => {
    localStorage.setItem("theme", t);
    setSaved(true);
    setTheme(t);
  };
  return { theme, choose };
}

/**
 * "segmented": Light / Dark switch styled for the dark sidebar.
 * "icon": one button that flips between Light and Dark.
 */
export function ThemeToggle({ variant = "icon" }: { variant?: "segmented" | "icon" }) {
  const { theme, choose } = useTheme();

  if (variant === "segmented") {
    return (
      <div role="radiogroup" aria-label="Theme" className="flex rounded-lg bg-white/6 p-1">
        {options.map((o) => {
          const active = theme === o.value;
          return (
            <button
              key={o.value}
              role="radio"
              aria-checked={active}
              title={o.label}
              onClick={() => choose(o.value)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
                active ? "bg-white/15 text-white" : "text-white/55 hover:text-white"
              }`}
            >
              <o.icon size={14} />
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  const next = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Moon : Sun;
  return (
    <button
      onClick={() => choose(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-surface2 hover:text-ink"
    >
      <Icon size={18} />
    </button>
  );
}
