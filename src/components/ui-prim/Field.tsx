import { cn } from "@/lib/utils";

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export function FieldRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap gap-4", className)}>{children}</div>;
}

export function InfoBox({
  type = "info",
  children,
}: {
  type?: "info" | "success" | "warning";
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-info/10 border-info/30 text-foreground",
    success: "bg-success/10 border-success/30 text-foreground",
    warning: "bg-warning/10 border-warning/40 text-foreground",
  }[type];
  return <div className={cn("rounded-md border px-3 py-2 text-sm", styles)}>{children}</div>;
}
