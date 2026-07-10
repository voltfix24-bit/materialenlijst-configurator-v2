import { describe, it, expect } from "vitest";
import {
  parseColor,
  composite,
  contrastRatio,
  relLuminance,
} from "./contrast-check";

const WHITE = { r: 255, g: 255, b: 255, a: 1 };
const BLACK = { r: 0, g: 0, b: 0, a: 1 };
const NAVY = { r: 14, g: 30, b: 53, a: 1 }; // #0e1e35
const SLATE = { r: 241, g: 245, b: 249, a: 1 }; // #f1f5f9

describe("contrast-check pure helpers", () => {
  it("parseColor herkent rgb, rgba en transparent", () => {
    expect(parseColor("rgb(10, 20, 30)")).toEqual({ r: 10, g: 20, b: 30, a: 1 });
    expect(parseColor("rgba(10, 20, 30, 0.5)")).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(parseColor("transparent")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(parseColor("")).toBeNull();
  });

  it("relLuminance klopt op de uitersten", () => {
    expect(relLuminance(WHITE)).toBeCloseTo(1, 3);
    expect(relLuminance(BLACK)).toBeCloseTo(0, 3);
  });

  it("contrastRatio wit op zwart is 21:1", () => {
    expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 1);
  });

  it("wit op licht-slate faalt AA (te laag contrast)", () => {
    // Reproduceert het CS-via-Prov probleem uit dark mode.
    const ratio = contrastRatio(WHITE, SLATE);
    expect(ratio).toBeLessThan(4.5);
  });

  it("wit op donkere navy haalt AA ruim", () => {
    expect(contrastRatio(WHITE, NAVY)).toBeGreaterThan(4.5);
  });

  it("composite lost half-transparant wit op zwart correct op", () => {
    const half = { r: 255, g: 255, b: 255, a: 0.5 };
    const out = composite(half, BLACK);
    expect(out.r).toBeCloseTo(127.5, 1);
    expect(out.a).toBeCloseTo(1, 3);
  });
});
