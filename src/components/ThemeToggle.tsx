"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const options: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function useTheme() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    setTheme(saved === "light" || saved === "dark" ? saved : "system");
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const choose = (t: Theme) => {
    localStorage.setItem("theme", t);
    setTheme(t);
  };
  return { theme, choose };
}

/**
 * "segmented": three-way switch styled for the dark sidebar.
 * "icon": one button that cycles Light, Dark, System; styled for light/dark surfaces.
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

  const current = options.find((o) => o.value === theme) ?? options[2];
  const next = options[(options.indexOf(current) + 1) % options.length];
  return (
    <button
      onClick={() => choose(next.value)}
      aria-label={`Theme: ${current.label}. Switch to ${next.label}`}
      title={`Theme: ${current.label} (click for ${next.label})`}
      className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-surface2 hover:text-ink"
    >
      <current.icon size={18} />
    </button>
  );
}
