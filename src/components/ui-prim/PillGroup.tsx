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

export function PillGroup<T extends string>({ value, onChange, options, size = "md" }: Props<T>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-lg font-medium transition-all",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
              active
                ? "bg-primary text-primary-foreground shadow-sm border border-primary"
                : "bg-muted text-muted-foreground border border-border hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
