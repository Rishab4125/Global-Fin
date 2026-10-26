import type { LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "gain" | "loss";
  icon?: LucideIcon;
}) {
  const color = tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink";
  return (
    <div className="card !p-4 sm:!p-5">
      <div className="flex items-center justify-between">
        <span className="kpi-label">{label}</span>
        {Icon && (
          <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary">
            <Icon size={16} />
          </span>
        )}
      </div>
      <div className={`num mt-2 text-[26px] font-semibold leading-none tracking-tight ${color}`}>{value}</div>
      {hint && <div className="mt-2 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
  flush,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="card !p-0 overflow-hidden">
      {title && (
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      )}
      <div className={flush ? "overflow-x-auto" : "p-5"}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary">
        <Icon size={20} />
      </span>
      <p className="mt-3 font-medium">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
