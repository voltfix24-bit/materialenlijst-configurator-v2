import { cn } from "@/lib/utils";
import { Info, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap gap-4", className)}>{children}</div>;
}

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: AlertCircle };

export function InfoBox({
  type = "info",
  children,
}: {
  type?: "info" | "success" | "warning" | "error";
  children: ReactNode;
}) {
  const styles = {
    info: "bg-info/10 border-info/30 text-foreground",
    success: "bg-success/10 border-success/30 text-foreground",
    warning: "bg-warning/10 border-warning/40 text-foreground",
    error: "bg-destructive/10 border-destructive/40 text-foreground",
  }[type];
  const iconColor = {
    info: "text-info",
    success: "text-success",
    warning: "text-warning",
    error: "text-destructive",
  }[type];
  const Icon = ICONS[type];
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm flex items-start gap-2", styles)}>
      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", iconColor)} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
