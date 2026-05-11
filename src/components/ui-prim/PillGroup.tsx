import { cn } from "@/lib/utils";

export type PillColor = "default" | "green" | "amber" | "blue" | "red";

export interface PillOption<T extends string> {
  value: T;
  label: string;
  color?: PillColor;
}

interface Props<T extends string> {
  value: T | "" | null | undefined;
  onChange: (v: T) => void;
  options: PillOption<T>[];
  size?: "sm" | "md";
}

const colorClasses: Record<PillColor, string> = {
  default: "data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary",
  green: "data-[active=true]:bg-success data-[active=true]:text-background data-[active=true]:border-success",
  amber: "data-[active=true]:bg-warning data-[active=true]:text-background data-[active=true]:border-warning",
  blue: "data-[active=true]:bg-info data-[active=true]:text-background data-[active=true]:border-info",
  red: "data-[active=true]:bg-destructive data-[active=true]:text-destructive-foreground data-[active=true]:border-destructive",
};

export function PillGroup<T extends string>({ value, onChange, options, size = "md" }: Props<T>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            data-active={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "border border-border bg-surface text-foreground rounded-md transition-colors hover:bg-accent",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              colorClasses[opt.color ?? "default"],
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
