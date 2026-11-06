import { isoDay, offerMonth, todayInPoland, types, type BondType } from "./bonds";

export function parsePurchase(data: FormData) {
  const type = String(data.get("type"));
  const purchasedOn = String(data.get("purchasedOn"));
  const id = String(data.get("id"));
  const quantity = Number(data.get("quantity"));
  const parsed = Date.parse(purchasedOn);
  if (!Object.hasOwn(types, type) || !/^\d{4}-\d{2}-\d{2}$/.test(purchasedOn) ||
      !Number.isFinite(parsed) || isoDay(parsed) !== purchasedOn ||
      purchasedOn < "2000-01-01" || purchasedOn > todayInPoland() ||
      !Number.isInteger(quantity) || quantity < 1 || quantity > 100_000 ||
      !/^[0-9a-f-]{36}$/i.test(id)) {
    return "Sprawdź typ, datę zakupu i liczbę sztuk.";
  }

  const terms = types[type as BondType];
  const known = purchasedOn.startsWith(offerMonth);
  const readBp = (name: string) => {
    const raw = String(data.get(name) ?? "").trim();
    return /^\d{1,2}([.,]\d{1,2})?$/.test(raw) ? Math.round(Number(raw.replace(",", ".")) * 100) : NaN;
  };
  const rateBp = known ? terms.rate : readBp("rate");
  const marginBp = type === "TOS" ? 0 : known ? terms.margin : readBp("margin");
  const feeCents = known ? terms.fee : readBp("fee");
  if (!Number.isFinite(rateBp) || !Number.isFinite(marginBp) || !Number.isFinite(feeCents)) {
    return "Wpisz stawkę, marżę i opłatę zgodnie z listem emisyjnym.";
  }
  return { id, type, purchasedOn, quantity, rateBp, marginBp, feeCents };
}
