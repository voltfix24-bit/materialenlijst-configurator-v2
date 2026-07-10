#!/usr/bin/env node
/**
 * CI contrast-check voor dark mode.
 *
 * Start een headless Chromium, laadt elke route in dark mode en draait
 * dezelfde WCAG AA contrast-scan als `src/lib/a11y/contrast-check.ts`.
 * Exit-code != 0 bij issues, zodat CI de build breekt.
 *
 * Config via env:
 *   BASE_URL   default http://localhost:8080
 *   ROUTES     comma-separated pad-lijst, default "/,/cases,/cases/tabel,/beheer,/notificaties"
 *   MAX_ISSUES default 0 (elke overtreding faalt)
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:8080";
const ROUTES = (process.env.ROUTES || "/,/cases,/cases/tabel,/beheer,/notificaties")
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);
const MAX_ISSUES = Number(process.env.MAX_ISSUES || 0);

// In-browser scan — spiegelt src/lib/a11y/contrast-check.ts.
const SCAN_FN = /* js */ `
(() => {
  const parseColor = (s) => {
    if (!s) return null;
    s = s.trim();
    if (s === "transparent") return { r:0, g:0, b:0, a:0 };
    const m = s.match(/^rgba?\\(([^)]+)\\)$/i);
    if (!m) return null;
    const p = m[1].split(/[,\\s/]+/).filter(Boolean);
    if (p.length < 3) return null;
    const [r,g,b] = p.map(parseFloat);
    const a = p[3] !== undefined ? parseFloat(p[3]) : 1;
    if ([r,g,b,a].some(Number.isNaN)) return null;
    return { r, g, b, a };
  };
  const composite = (o, u) => {
    const a = o.a + u.a * (1 - o.a);
    if (a === 0) return { r:0, g:0, b:0, a:0 };
    return {
      r: (o.r*o.a + u.r*u.a*(1-o.a))/a,
      g: (o.g*o.a + u.g*u.a*(1-o.a))/a,
      b: (o.b*o.a + u.b*u.a*(1-o.a))/a,
      a,
    };
  };
  const relLum = ({r,g,b}) => {
    const c = (v) => { const s=v/255; return s<=0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055, 2.4); };
    return 0.2126*c(r) + 0.7152*c(g) + 0.0722*c(b);
  };
  const ratio = (fg, bg) => {
    const l1 = relLum(fg), l2 = relLum(bg);
    const [a,b] = l1>l2 ? [l1,l2] : [l2,l1];
    return (a+0.05)/(b+0.05);
  };
  const effBg = (el) => {
    let cur = el, bg = { r:0, g:0, b:0, a:0 };
    while (cur) {
      const c = parseColor(getComputedStyle(cur).backgroundColor);
      if (c && c.a > 0) { bg = composite(bg, c); if (bg.a >= 0.999) return bg; }
      cur = cur.parentElement;
    }
    const body = parseColor(getComputedStyle(document.body).backgroundColor) || { r:255,g:255,b:255,a:1 };
    return composite(bg, body);
  };
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const sel = (el) => {
    const id = el.id ? "#"+el.id : "";
    const cls = (typeof el.className === "string" && el.className.trim())
      ? "."+el.className.trim().split(/\\s+/).slice(0,2).join(".") : "";
    return (el.tagName.toLowerCase()+id+cls).slice(0,80);
  };
  const issues = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (["SCRIPT","STYLE","NOSCRIPT"].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
      if (!visible(p)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const seen = new Set();
  let n;
  while ((n = walker.nextNode())) {
    const el = n.parentElement;
    if (seen.has(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    const fg = parseColor(cs.color);
    if (!fg) continue;
    const bg = effBg(el);
    const fgOn = composite(fg, bg);
    const r = ratio(fgOn, bg);
    const fs = parseFloat(cs.fontSize) || 16;
    const fw = parseInt(cs.fontWeight, 10) || 400;
    const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
    const req = large ? 3 : 4.5;
    if (r + 0.01 < req) {
      issues.push({
        selector: sel(el),
        text: (n.nodeValue || "").trim().slice(0, 60),
        fg: cs.color,
        bg: \`rgba(\${bg.r.toFixed(0)}, \${bg.g.toFixed(0)}, \${bg.b.toFixed(0)}, \${bg.a.toFixed(2)})\`,
        ratio: Math.round(r*100)/100,
        required: req,
      });
    }
  }
  return issues.sort((a,b) => a.ratio - b.ratio);
})()
`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
const page = await context.newPage();

// Zet dark mode voordat de app hydrateert.
await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  localStorage.setItem("mc-theme", "dark");
  document.documentElement.classList.add("dark");
});

const all = [];
for (const path of ROUTES) {
  const url = new URL(path, BASE_URL).toString();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
  } catch {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  }
  await page.waitForTimeout(500);
  const issues = await page.evaluate(SCAN_FN);
  console.log(`\n[${path}] ${issues.length} contrast issue(s)`);
  for (const i of issues) {
    console.log(
      `  ${i.ratio}:1 (< ${i.required}) ${i.selector} — "${i.text}" fg=${i.fg} bg=${i.bg}`,
    );
    all.push({ path, ...i });
  }
}

await browser.close();

console.log(`\nTotal: ${all.length} issue(s) across ${ROUTES.length} route(s).`);
if (all.length > MAX_ISSUES) {
  console.error(`FAIL: contrast issues (${all.length}) > MAX_ISSUES (${MAX_ISSUES}).`);
  process.exit(1);
}
console.log("OK: contrast within WCAG AA.");
