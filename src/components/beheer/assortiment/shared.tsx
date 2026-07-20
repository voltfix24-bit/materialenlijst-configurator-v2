import type { ReactNode } from "react";

/** Gedeelde presentatie-primitieven voor de assortiment-panelen. */

export function Stat({
  label,
  count,
  icon,
  color,
}: {
  label: string;
  count: number;
  icon: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className={`text-2xl font-mono mt-0.5 ${color}`}>{count}</div>
    </div>
  );
}

export function DiffSectie({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <details className="rounded-lg border border-border bg-surface overflow-hidden" open>
      <summary className="px-3 py-2 text-xs font-mono uppercase tracking-wider text-muted-foreground cursor-pointer hover:bg-accent/30">
        {titel}
      </summary>
      <div className="border-t border-border max-h-80 overflow-auto">{children}</div>
    </details>
  );
}

export function Leeg() {
  return <div className="px-3 py-4 text-xs text-muted-foreground text-center">Geen.</div>;
}

export function Meer({ n }: { n: number }) {
  return (
    <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
      …en nog {n} meer
    </div>
  );
}
