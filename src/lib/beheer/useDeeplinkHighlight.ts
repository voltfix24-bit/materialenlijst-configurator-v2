import { useEffect, useState } from "react";

/**
 * Zoekt na elke render naar een DOM-element met `data-row-id={rowId}`,
 * scrollt het in beeld en geeft het 6 seconden lang een highlight via
 * `data-highlight="true"`. Geeft terug of de rij gevonden is, zodat de
 * caller een "niet gevonden"-melding kan tonen.
 *
 * - Wacht max 30 frames (≈ 500ms) tot de tab/data klaar is met laden.
 * - Reset wanneer rowId verandert.
 */
export function useDeeplinkHighlight(rowId: string | undefined): {
  status: "idle" | "searching" | "found" | "not_found";
} {
  const [status, setStatus] = useState<"idle" | "searching" | "found" | "not_found">("idle");

  useEffect(() => {
    if (!rowId) {
      setStatus("idle");
      return;
    }
    setStatus("searching");
    let frames = 0;
    let cancelled = false;
    let highlightTimer: ReturnType<typeof setTimeout> | null = null;
    let notFoundTimer: ReturnType<typeof setTimeout> | null = null;

    const tryFind = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(rowId)}"]`);
      if (el) {
        el.setAttribute("data-highlight", "true");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setStatus("found");
        highlightTimer = setTimeout(() => {
          el.removeAttribute("data-highlight");
        }, 6000);
        return;
      }
      frames += 1;
      if (frames > 30) {
        // ~500 ms zonder match: nog 2 s wachten op data-load, anders not_found.
        notFoundTimer = setTimeout(() => {
          if (cancelled) return;
          const again = document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(rowId)}"]`);
          if (again) {
            again.setAttribute("data-highlight", "true");
            again.scrollIntoView({ behavior: "smooth", block: "center" });
            setStatus("found");
            highlightTimer = setTimeout(() => again.removeAttribute("data-highlight"), 6000);
          } else {
            setStatus("not_found");
          }
        }, 2000);
        return;
      }
      requestAnimationFrame(tryFind);
    };

    requestAnimationFrame(tryFind);

    return () => {
      cancelled = true;
      if (highlightTimer) clearTimeout(highlightTimer);
      if (notFoundTimer) clearTimeout(notFoundTimer);
    };
  }, [rowId]);

  return { status };
}
