// Centralised currency formatting for the whole app — Indian Rupee (₹).
// Change CURRENCY_SYMBOL / locale here to switch currency everywhere.
export const CURRENCY_SYMBOL = "₹";

/** Format an amount as ₹ with Indian digit grouping, e.g. ₹1,23,456.00 */
export function money(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return CURRENCY_SYMBOL + (Number.isFinite(n) ? n : 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
