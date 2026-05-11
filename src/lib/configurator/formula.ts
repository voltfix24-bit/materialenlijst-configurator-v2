export function evaluateFormula(formula: string, vars: Record<string, number>): number {
  let expr = formula;
  for (const [key, val] of Object.entries(vars)) {
    expr = expr.replaceAll(key, String(val));
  }
  if (!/^[\d\s+\-*/().]+$/.test(expr)) return 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    return Number(new Function(`return (${expr})`)()) || 0;
  } catch {
    return 0;
  }
}
