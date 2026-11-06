import { isoDay, types, type Purchase } from "./bonds";

export const storageKey = "obligacje.portfolio.v1";

export function decodePortfolio(raw: string): Purchase[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error("Nieprawidłowy portfel");
  const ids = new Set<string>();
  const purchases = value.map((item: unknown): Purchase => {
    if (!item || typeof item !== "object") throw new Error("Nieprawidłowy zakup");
    const p = item as Purchase;
    const date = typeof p.purchasedOn === "string" ? Date.parse(p.purchasedOn) : NaN;
    if (typeof p.id !== "string" || !/^[0-9a-f-]{36}$/i.test(p.id) || ids.has(p.id) ||
        typeof p.type !== "string" || !Object.hasOwn(types, p.type) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(p.purchasedOn) || !Number.isFinite(date) ||
        isoDay(date) !== p.purchasedOn || p.purchasedOn < "2000-01-01" ||
        !Number.isInteger(p.quantity) || p.quantity < 1 || p.quantity > 100_000 ||
        ![p.rateBp, p.marginBp, p.feeCents].every(n => Number.isInteger(n) && n >= 0 && n <= 9999)) {
      throw new Error("Nieprawidłowy zakup");
    }
    ids.add(p.id);
    return { id: p.id, type: p.type, purchasedOn: p.purchasedOn, quantity: p.quantity,
      rateBp: p.rateBp, marginBp: p.marginBp, feeCents: p.feeCents };
  });
  return purchases.sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn) || b.id.localeCompare(a.id));
}

export function readPortfolio(): Purchase[] {
  return decodePortfolio(localStorage.getItem(storageKey) ?? "[]");
}

export function writePortfolio(purchases: Purchase[]) {
  const raw = JSON.stringify(purchases);
  decodePortfolio(raw);
  localStorage.setItem(storageKey, raw);
}
