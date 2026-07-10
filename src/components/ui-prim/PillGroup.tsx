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
  disabled?: boolean;
}

export function PillGroup<T extends string>({ value, onChange, options, size = "md", disabled = false }: Props<T>) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-lg font-medium transition-colors border",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
              disabled && "opacity-50 cursor-not-allowed",
              active
                ? "bg-primary text-primary-foreground border-primary shadow-sm hover:bg-primary/90"
                : "bg-muted text-foreground border-border hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/20",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
