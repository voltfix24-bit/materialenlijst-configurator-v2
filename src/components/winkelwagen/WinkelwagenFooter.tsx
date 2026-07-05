import type { ReactNode } from "react";
import { Download, Loader2 } from "lucide-react";

interface WinkelwagenFooterProps {
  teBestellen: number;
  saving: boolean;
  exportPending?: boolean;
  exportDisabled?: boolean;
  exportProblemenAantal: number;
  onSave: () => void;
  onExport: () => void;
  children?: ReactNode;
}

export function WinkelwagenFooter({
  teBestellen,
  saving,
  exportPending,
  exportDisabled,
  exportProblemenAantal,
  onSave,
  onExport,
  children,
}: WinkelwagenFooterProps) {
  return (
    <div className="border-t border-border px-6 py-4 space-y-3 bg-card flex-shrink-0">
      {children}

      <div className="flex items-center justify-between text-sm pt-1">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Te bestellen</span>
        <span className="font-mono font-semibold text-foreground">{teBestellen}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={saving}
          onClick={onSave}
          className="flex-shrink-0 px-3 py-2.5 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-50"
        >
          {saving ? "…" : "Opslaan"}
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={exportDisabled}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold py-2.5 text-sm hover:bg-[color:var(--primary-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          {exportPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Export naar Liander
          {exportProblemenAantal > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">
              {exportProblemenAantal}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
