import { Minus, Plus } from "lucide-react";

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
  return (
    <div className="inline-flex items-center gap-2 bg-surface border border-border rounded-md px-1.5 py-1">
      <button type="button" onClick={dec} className="w-6 h-6 rounded hover:bg-accent flex items-center justify-center">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
        className="w-14 bg-transparent text-center text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {suffix && <span className="text-xs text-muted-foreground pr-1">{suffix}</span>}
      <button type="button" onClick={inc} className="w-6 h-6 rounded hover:bg-accent flex items-center justify-center">
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
