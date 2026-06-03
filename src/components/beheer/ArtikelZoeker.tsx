import { useEffect, useMemo, useRef, useState } from "react";
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
  categorie?: string | null;
}

/** Canonieke status "Uitgelopen"; "Uitloop" wordt als legacy DB-waarde ondersteund. */
function isUitgelopenStatus(status: string | null | undefined): boolean {
  return status === "Uitgelopen" || status === "Uitloop";
}

function statusColor(status: string | null | undefined) {
  if (isUitgelopenStatus(status)) return "text-muted-foreground";
  return "text-foreground";
}

export function ArtikelZoeker({
  value,
  onChange,
  placeholder = "Zoek artikel...",
  className,
  categorieSuggesties,
}: {
  value: string | null;
  onChange: (id: string | null, artikel?: ArtikelMini) => void;
  placeholder?: string;
  className?: string;
  categorieSuggesties?: string[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const cats = useMemo(() => categorieSuggesties ?? [], [categorieSuggesties]);
  const catsKey = cats.join("|");

  const { data: selected } = useQuery({
    queryKey: ["artikel-mini", value],
    enabled: !!value,
    queryFn: async () => {
      const { data } = await supabase
        .from("artikelen")
        .select("id,artikel_nummer,korte_omschrijving,status,categorie")
        .eq("id", value!)
        .maybeSingle();
      return data as ArtikelMini | null;
    },
  });

  // Suggestions when input is empty and category filter is provided
  const { data: suggestions = [] } = useQuery({
    queryKey: ["artikel-suggesties", catsKey],
    enabled: cats.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("artikelen")
        .select("id,artikel_nummer,korte_omschrijving,status,categorie")
        .in("categorie", cats)
        .neq("status", "Geblokkeerd")
        .order("artikel_nummer")
        .limit(15);
      return (data ?? []) as ArtikelMini[];
    },
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["artikel-search", query, catsKey],
    enabled: query.length >= 2,
    queryFn: async () => {
      const q = query.replace(/[%,]/g, "");
      // Search in-category first
      let inCat: ArtikelMini[] = [];
      if (cats.length > 0) {
        const { data } = await supabase
          .from("artikelen")
          .select("id,artikel_nummer,korte_omschrijving,status,categorie")
          .in("categorie", cats)
          .neq("status", "Geblokkeerd")
          .or(`artikel_nummer.ilike.%${q}%,korte_omschrijving.ilike.%${q}%`)
          .limit(10);
        inCat = (data ?? []) as ArtikelMini[];
      }
      const remainingLimit = 10 - inCat.length;
      let outCat: ArtikelMini[] = [];
      if (remainingLimit > 0) {
        let qb = supabase
          .from("artikelen")
          .select("id,artikel_nummer,korte_omschrijving,status,categorie")
          .neq("status", "Geblokkeerd")
          .or(`artikel_nummer.ilike.%${q}%,korte_omschrijving.ilike.%${q}%`)
          .limit(remainingLimit);
        if (cats.length > 0) qb = qb.not("categorie", "in", `(${cats.map((c) => `"${c}"`).join(",")})`);
        const { data } = await qb;
        outCat = (data ?? []) as ArtikelMini[];
      }
      return [...inCat, ...outCat];
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
          {isUitgelopenStatus(selected.status) && <span className="text-[10px] text-muted-foreground shrink-0">(uitgelopen)</span>}
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

  const showSuggestions = open && query.length < 2 && cats.length > 0 && suggestions.length > 0;
  const showSearch = open && query.length >= 2;
  const items = showSearch ? searchResults : showSuggestions ? suggestions : [];
  const headerLabel =
    showSearch
      ? cats.length > 0
        ? `Zoeken — voorkeur: ${cats.join(", ")}`
        : "Alle artikelen"
      : showSuggestions
        ? `Suggesties uit: ${cats.join(", ")}`
        : null;

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
      {(showSearch || showSuggestions) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-surface shadow-lg max-h-80 overflow-auto">
          {headerLabel && (
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-surface-2 border-b border-border sticky top-0">
              {headerLabel}
            </div>
          )}
          {items.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Geen resultaten.</div>
          )}
          {items.map((r) => {
            const isUitloop = isUitgelopenStatus(r.status);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onChange(r.id, r);
                  setQuery("");
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-accent border-b border-border last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span className={cn("font-mono text-xs shrink-0", isUitloop && "text-muted-foreground")}>{r.artikel_nummer}</span>
                  <span className={cn("text-sm truncate", isUitloop && "text-muted-foreground")}>{r.korte_omschrijving}</span>
                  {isUitloop && <span className="text-[10px] text-muted-foreground shrink-0">(uitgelopen)</span>}
                </div>
                {r.categorie && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">{r.categorie}</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
