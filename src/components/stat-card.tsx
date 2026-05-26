import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = "default",
  hint,
  children,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive" | "primary" | "accent";
  hint?: string;
  children?: ReactNode;
}) {
  const toneClasses = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    primary: "text-primary",
    accent: "text-accent",
  }[tone];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
            <Icon className={cn("h-4 w-4", toneClasses)} />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className={cn("text-3xl font-semibold tracking-tight", toneClasses)}>{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
