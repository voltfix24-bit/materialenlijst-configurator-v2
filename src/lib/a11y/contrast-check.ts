/**
 * Runtime contrast-check voor dark mode (WCAG 2.1).
 *
 * Scant alle zichtbare tekst-nodes in het DOM, berekent de effectieve
 * achtergrondkleur (via ouder-cascade + alpha-compositing op body/html)
 * en flagt elementen met een lager contrast dan de WCAG AA drempel.
 *
 * Gebruik in de browser:
 *   import("@/lib/a11y/contrast-check").then(m => console.table(m.scanContrast()))
 *
 * Of, bij handmatig testen, plak in DevTools:
 *   window.__checkContrast?.()
 *
 * Return: array met {selector, text, fg, bg, ratio, required, level}.
 */

export interface ContrastIssue {
  selector: string;
  text: string;
  fg: string;
  bg: string;
  ratio: number;
  required: number;
  level: "AA" | "AA-large";
  fontSize: number;
  fontWeight: number;
}

type RGBA = { r: number; g: number; b: number; a: number };

export function parseColor(input: string): RGBA | null {
  if (!input) return null;
  const s = input.trim();
  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (!m) return null;
  const parts = m[1].split(/[,\s/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const r = parseFloat(parts[0]);
  const g = parseFloat(parts[1]);
  const b = parseFloat(parts[2]);
  const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
  if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
  return { r, g, b, a };
}

export function composite(over: RGBA, under: RGBA): RGBA {
  const a = over.a + under.a * (1 - over.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (over.r * over.a + under.r * under.a * (1 - over.a)) / a,
    g: (over.g * over.a + under.g * under.a * (1 - over.a)) / a,
    b: (over.b * over.a + under.b * under.a * (1 - over.a)) / a,
    a,
  };
}

export function relLuminance({ r, g, b }: RGBA): number {
  const conv = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * conv(r) + 0.7152 * conv(g) + 0.0722 * conv(b);
}

export function contrastRatio(fg: RGBA, bg: RGBA): number {
  const l1 = relLuminance(fg);
  const l2 = relLuminance(bg);
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

function effectiveBackground(el: Element): RGBA {
  let cur: Element | null = el;
  let bg: RGBA = { r: 0, g: 0, b: 0, a: 0 };
  while (cur) {
    const cs = getComputedStyle(cur);
    const c = parseColor(cs.backgroundColor);
    if (c && c.a > 0) {
      bg = composite(bg, c);
      if (bg.a >= 0.999) return bg;
    }
    cur = cur.parentElement;
  }
  // Val terug op body/html
  const bodyBg = parseColor(getComputedStyle(document.body).backgroundColor) || {
    r: 255,
    g: 255,
    b: 255,
    a: 1,
  };
  return composite(bg, bodyBg);
}

function shortSelector(el: Element): string {
  const id = el.id ? `#${el.id}` : "";
  const cls =
    (el.className && typeof el.className === "string" && el.className.trim())
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
  return `${el.tagName.toLowerCase()}${id}${cls}`.slice(0, 80);
}

function isVisible(el: Element): boolean {
  const cs = getComputedStyle(el);
  if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") return false;
  const r = (el as HTMLElement).getBoundingClientRect?.();
  if (!r || r.width === 0 || r.height === 0) return false;
  return true;
}

export function scanContrast(root: Element = document.body): ContrastIssue[] {
  const issues: ContrastIssue[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const t = node.nodeValue?.trim();
      if (!t) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
      if (!isVisible(parent)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const seen = new Set<Element>();
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const el = (node as Text).parentElement!;
    if (seen.has(el)) continue;
    seen.add(el);

    const cs = getComputedStyle(el);
    const fg = parseColor(cs.color);
    if (!fg) continue;
    const bg = effectiveBackground(el);
    // Composite fg on bg voor de alpha van de tekst zelf
    const fgOnBg = composite(fg, bg);
    const ratio = contrastRatio(fgOnBg, bg);

    const fontSize = parseFloat(cs.fontSize) || 16;
    const fontWeight = parseInt(cs.fontWeight, 10) || 400;
    const largeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
    const required = largeText ? 3 : 4.5;

    if (ratio + 0.01 < required) {
      issues.push({
        selector: shortSelector(el),
        text: (node.nodeValue || "").trim().slice(0, 60),
        fg: cs.color,
        bg: `rgba(${bg.r.toFixed(0)}, ${bg.g.toFixed(0)}, ${bg.b.toFixed(0)}, ${bg.a.toFixed(2)})`,
        ratio: Math.round(ratio * 100) / 100,
        required,
        level: largeText ? "AA-large" : "AA",
        fontSize,
        fontWeight,
      });
    }
  }

  return issues.sort((a, b) => a.ratio - b.ratio);
}

/** Log resultaat als groepstabel in de console. */
export function reportContrast(root?: Element): ContrastIssue[] {
  const issues = scanContrast(root);
  const dark = document.documentElement.classList.contains("dark");
  const label = `Contrast-check (${dark ? "dark" : "light"} mode) — ${issues.length} issue(s)`;
  // eslint-disable-next-line no-console
  console.groupCollapsed(label);
  if (issues.length === 0) {
    // eslint-disable-next-line no-console
    console.log("Geen WCAG AA contrast-issues gevonden.");
  } else {
    // eslint-disable-next-line no-console
    console.table(issues);
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
  return issues;
}

// Alleen in de browser en niet in productie exporeren op window
if (typeof window !== "undefined" && import.meta.env?.DEV) {
  (window as unknown as { __checkContrast?: typeof reportContrast }).__checkContrast =
    reportContrast;
}
