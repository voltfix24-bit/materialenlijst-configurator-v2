import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

export interface ArtikelMini {
  id: string;
  artikel_nummer: string;
  korte_omschrijving: string;
  status: string | null;
}

function statusColor(status: string | null | undefined) {
  if (status === "Geblokkeerd") return "text-destructive";
  if (status === "Uitloop") return "text-muted-foreground";
  return "text-foreground";
}

export function ArtikelZoeker({
  value,
  onChange,
  placeholder = "Zoek artikel...",
  className,
}: {
  value: string | null;
  onChange: (id: string | null, artikel?: ArtikelMini) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: selected } = useQuery({
    queryKey: ["artikel-mini", value],
    enabled: !!value,
    queryFn: async () => {
      const { data } = await supabase
        .from("artikelen")
        .select("id,artikel_nummer,korte_omschrijving,status")
        .eq("id", value!)
        .maybeSingle();
      return data as ArtikelMini | null;
    },
  });

  const { data: results = [] } = useQuery({
    queryKey: ["artikel-search", query],
    enabled: query.length >= 2,
    queryFn: async () => {
      const q = query.replace(/[%,]/g, "");
      const { data } = await supabase
        .from("artikelen")
        .select("id,artikel_nummer,korte_omschrijving,status")
        .or(`artikel_nummer.ilike.%${q}%,korte_omschrijving.ilike.%${q}%`)
        .limit(10);
      return (data ?? []) as ArtikelMini[];
    },
  });

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selected && value) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm",
          className,
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("font-mono text-xs shrink-0", statusColor(selected.status))}>{selected.artikel_nummer}</span>
          <span className={cn("truncate", statusColor(selected.status))}>{selected.korte_omschrijving}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="h-9"
      />
      {open && query.length >= 2 && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-surface shadow-lg max-h-72 overflow-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                onChange(r.id, r);
                setQuery("");
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 border-b border-border last:border-b-0"
            >
              <span className={cn("font-mono text-xs shrink-0", statusColor(r.status))}>{r.artikel_nummer}</span>
              <span className={cn("text-sm truncate", statusColor(r.status))}>{r.korte_omschrijving}</span>
            </button>
          ))}
        </div>
      )}
      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
          Geen resultaten.
        </div>
      )}
    </div>
  );
}
