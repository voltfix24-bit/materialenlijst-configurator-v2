import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, History } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

interface ExportRij {
  id: string;
  created_at: string;
  bestand_naam: string;
  aantal_artikelen: number;
  matched: number;
  unmatched: unknown;
  inactief: unknown;
}

/**
 * Toont de bevroren exportsnapshots van een case: elke Excel-export is een
 * bestelling richting Liander, dus hier is altijd terug te vinden wat wanneer
 * besteld is — ook nadat regels of stamdata later gewijzigd zijn.
 */
export function ExportHistoriePopover({ caseId }: { caseId: string }) {
  const { data } = useQuery({
    queryKey: ["case-exporten", caseId],
    queryFn: async (): Promise<ExportRij[]> => {
      const { data, error } = await supabase
        .from("case_exporten")
        .select("id, created_at, bestand_naam, aantal_artikelen, matched, unmatched, inactief")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as ExportRij[];
    },
    // Tabel kan ontbreken zolang de migratie niet is uitgevoerd — niet blijven proberen
    retry: false,
  });

  if (!data || data.length === 0) return null;

  const laatste = data[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="px-3 py-2 rounded-lg border border-border text-muted-foreground text-sm hover:bg-muted hover:text-foreground transition-colors flex items-center gap-1.5"
          title={`Laatst geëxporteerd ${formatDistanceToNow(new Date(laatste.created_at), { locale: nl, addSuffix: true })}`}
        >
          <History className="h-4 w-4" />
          <span className="hidden xl:inline text-xs">{data.length}×</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-sm font-semibold">Exporthistorie</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Elke export is een vastgelegde bestelling — deze lijst wijzigt niet mee met latere
            aanpassingen.
          </p>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {data.map((e) => {
            const unmatchedCount = Array.isArray(e.unmatched) ? e.unmatched.length : 0;
            const inactiefCount = Array.isArray(e.inactief) ? e.inactief.length : 0;
            return (
              <div key={e.id} className="px-4 py-2.5 text-xs space-y-1">
                <div className="flex items-center gap-2 min-w-0">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-success shrink-0" />
                  <span className="font-medium truncate" title={e.bestand_naam}>
                    {e.bestand_naam}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span title={format(new Date(e.created_at), "d MMMM yyyy HH:mm", { locale: nl })}>
                    {formatDistanceToNow(new Date(e.created_at), { locale: nl, addSuffix: true })}
                  </span>
                  <span>{e.aantal_artikelen} artikelen</span>
                  {unmatchedCount > 0 && (
                    <span className="text-[color:var(--warning)]">
                      {unmatchedCount} niet gematcht
                    </span>
                  )}
                  {inactiefCount > 0 && (
                    <span className="text-[color:var(--warning)]">{inactiefCount} inactief</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
