import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1, suffix }: Props) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <div className="inline-flex items-center gap-2 bg-surface border border-border rounded-lg px-2 py-1">
      <button
        type="button"
        onClick={dec}
        disabled={atMin}
        className={cn(
          "w-8 h-8 rounded-full border flex items-center justify-center transition-colors",
          atMin
            ? "border-border text-muted-foreground/40 cursor-not-allowed"
            : "border-border text-foreground hover:bg-primary/10 hover:border-primary hover:text-primary",
        )}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
        className="w-12 bg-transparent text-center text-sm font-mono font-medium text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      <button
        type="button"
        onClick={inc}
        disabled={atMax}
        className={cn(
          "w-8 h-8 rounded-full border flex items-center justify-center transition-colors",
          atMax
            ? "border-border text-muted-foreground/40 cursor-not-allowed"
            : "border-border text-foreground hover:bg-primary/10 hover:border-primary hover:text-primary",
        )}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
