import { describe, it, expect } from "vitest";
import { scanContrast } from "./contrast-check";

function mount(html: string) {
  document.documentElement.classList.add("dark");
  document.body.innerHTML = `<div style="background: #0a0f1a; color: #f1f5f9; padding: 16px;">${html}</div>`;
}

describe("scanContrast", () => {
  it("flagt lichte tekst op lichte achtergrond", () => {
    mount(`<span style="background: #f1f5f9; color: #ffffff; font-size: 14px;">CS via Prov</span>`);
    const issues = scanContrast();
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].ratio).toBeLessThan(4.5);
    expect(issues[0].text).toContain("CS via Prov");
  });

  it("flagt niets voor sterke contrast tekst", () => {
    mount(`<span style="color: #ffffff; font-size: 14px;">Leesbaar op donkere navy</span>`);
    const issues = scanContrast();
    expect(issues).toEqual([]);
  });

  it("houdt rekening met alpha van achtergrond via ouder", () => {
    mount(
      `<div style="background: rgba(255,255,255,0.9); padding: 4px;">
         <span style="color: #cccccc; font-size: 14px;">Grijs op wit</span>
       </div>`,
    );
    const issues = scanContrast();
    expect(issues.length).toBeGreaterThan(0);
  });

  it("respecteert large-text drempel (3:1)", () => {
    mount(
      `<span style="color: #888888; background: #ffffff; font-size: 28px;">Groot maar matig contrast</span>`,
    );
    // ratio ~ 3.5 -> geen issue voor large text (>=3), zou wél issue zijn voor normaal (>=4.5)
    const issues = scanContrast();
    expect(issues.find((i) => i.text.includes("Groot"))).toBeUndefined();
  });
});
