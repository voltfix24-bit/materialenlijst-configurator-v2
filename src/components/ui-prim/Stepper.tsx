import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1, suffix, disabled = false }: Props) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  const atMin = value <= min;
  const atMax = value >= max;
  const decDisabled = disabled || atMin;
  const incDisabled = disabled || atMax;
  const btnBase =
    "w-8 h-8 rounded-full border flex items-center justify-center transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  return (
    <div className={cn(
      "inline-flex items-center gap-2 bg-surface border border-border rounded-lg px-2 py-1",
      disabled && "opacity-60",
    )}>
      <button
        type="button"
        onClick={dec}
        disabled={decDisabled}
        aria-label="Verlagen"
        className={cn(
          btnBase,
          decDisabled
            ? "border-border bg-muted/40 text-muted-foreground/70 cursor-not-allowed"
            : "border-border text-foreground hover:bg-primary hover:border-primary hover:text-primary-foreground",
        )}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
        className="w-12 bg-transparent text-center text-sm font-mono font-medium text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:cursor-not-allowed"
      />
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      <button
        type="button"
        onClick={inc}
        disabled={incDisabled}
        aria-label="Verhogen"
        className={cn(
          btnBase,
          incDisabled
            ? "border-border bg-muted/40 text-muted-foreground/70 cursor-not-allowed"
            : "border-border text-foreground hover:bg-primary hover:border-primary hover:text-primary-foreground",
        )}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
