export const types = {
  TOS: { years: 3, label: "3-letnie", rate: 440, margin: 0, fee: 100, compounds: true },
  COI: { years: 4, label: "4-letnie", rate: 475, margin: 150, fee: 200, compounds: false },
  EDO: { years: 10, label: "10-letnie", rate: 535, margin: 200, fee: 300, compounds: true },
  ROS: { years: 6, label: "6-letnie rodzinne", rate: 500, margin: 200, fee: 200, compounds: true },
  ROD: { years: 12, label: "12-letnie rodzinne", rate: 560, margin: 250, fee: 300, compounds: true },
} as const;

export type BondType = keyof typeof types;
export type Purchase = {
  id: string;
  type: string;
  purchasedOn: string;
  quantity: number;
  rateBp: number;
  marginBp: number;
  feeCents: number;
};

export const dayMs = 86_400_000;
export const assumedInflationBp = 250;
export const offerMonth = "2026-11";
export const money = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });
export const dateLabel = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeZone: "UTC" });
export const isoDay = (date: number) => new Date(date).toISOString().slice(0, 10);

export function todayInPoland() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date());
}

export function anniversary(start: number, year: number) {
  const date = new Date(start);
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + year);
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return date.getTime();
}

export function bondModel(purchase: Purchase) {
  const terms = types[purchase.type as BondType];
  const start = Date.parse(purchase.purchasedOn);
  const maturity = anniversary(start, terms.years);
  const duration = (maturity - start) / dayMs;
  const firstAnniversary = anniversary(start, 1);
  const maturityDate = isoDay(maturity);
  const series = purchase.type + maturityDate.slice(5, 7) + maturityDate.slice(2, 4);

  function quote(day: number) {
    const date = start + Math.max(0, Math.min(day, duration)) * dayMs;
    let earned = 0;
    let paid = 0;
    for (let year = 0; year < terms.years; year++) {
      const from = anniversary(start, year);
      if (date <= from) break;
      const to = anniversary(start, year + 1);
      const rate = year === 0 || purchase.type === "TOS"
        ? purchase.rateBp : assumedInflationBp + purchase.marginBp;
      const base = 10_000 + (terms.compounds ? earned : 0);
      earned += Math.round(base * rate / 10_000 * (Math.min(date, to) - from) / (to - from));
      if (!terms.compounds && date >= to) paid = earned;
    }
    const fee = date === maturity ? 0 : purchase.type === "COI" && date > firstAnniversary
      ? purchase.feeCents : Math.min(earned - paid, purchase.feeCents);
    const pln = purchase.quantity / 100;
    return {
      interest: earned * pln,
      paid: paid * pln,
      fee: fee * pln,
      result: (earned - fee) * pln,
      estimate: purchase.type !== "TOS" && date > firstAnniversary,
    };
  }

  // The marker identifies when interest first exceeds the full stated fee.
  let threshold: number | null = null;
  for (let day = 1; day < duration; day++) {
    if (quote(day).interest > purchase.feeCents * purchase.quantity / 100) {
      threshold = day;
      break;
    }
  }
  return { start, maturity, duration, quote, threshold, series };
}
