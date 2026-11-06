"use client";

import { useActionState, useEffect, useState } from "react";
import { parsePurchase } from "../lib/purchase-form";
import { readPortfolio, writePortfolio, decodePortfolio } from "../lib/portfolio-storage";
import { anniversary, assumedInflationBp, bondModel, todayInPoland, dateLabel, dayMs, money, offerMonth, types, type BondType, type Purchase } from "../lib/bonds";

export function Dashboard() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [today, setToday] = useState("");
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [selectedDays, setSelectedDays] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setToday(todayInPoland());
    const load = () => {
      try {
        setPurchases(readPortfolio());
        setStorageError("");
        setReady(true);
      } catch {
        setReady(false);
        setStorageError("Nie można odczytać portfela. Sprawdź dostęp do pamięci przeglądarki i poprawność zapisanych danych. Dane nie zostały nadpisane.");
      }
    };
    load();
    const onStorage = (event: StorageEvent) => {
      if (event.key === "obligacje.portfolio.v1" || event.key === null) load();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  function savePurchase(purchase: Purchase) {
    try {
      const current = readPortfolio();
      const next = current.some(item => item.id === purchase.id) ? current : [...current, purchase];
      writePortfolio(next);
      setPurchases(readPortfolio());
      return "";
    } catch {
      return "Nie udało się zapisać zakupu. Sprawdź dostęp i wolne miejsce w pamięci przeglądarki.";
    }
  }
  function deletePurchase(purchase: Purchase) {
    if (!window.confirm(`Usunąć zakup ${purchase.type} z ${dateLabel.format(Date.parse(purchase.purchasedOn))} (${purchase.quantity} szt.)?`)) return;
    try {
      const next = readPortfolio().filter(item => item.id !== purchase.id);
      writePortfolio(next);
      setPurchases(next);
      if (!next.length) setEditing(false);
      setSelectedDays(current => {
        const nextDays = { ...current };
        delete nextDays[purchase.id];
        return nextDays;
      });
      setStorageError("");
    } catch {
      setStorageError("Nie udało się usunąć zakupu. Sprawdź dostęp do pamięci przeglądarki i spróbuj ponownie.");
    }
  }
  function exportPortfolio() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(purchases, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `portfel-${today}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const [formId, setFormId] = useState("");
  if (!today || !ready) return <main className="canvas min-h-screen p-8"><p role={storageError ? "alert" : "status"}>{storageError || "Wczytywanie portfela…"}</p></main>;
  const now = Date.parse(today);
  const positions = purchases.map(purchase => {
    const model = bondModel(purchase);
    const elapsed = Math.min(model.duration, Math.max(0, (now - model.start) / dayMs));
    return { purchase, model, elapsed };
  });
  const total = positions.reduce((sum, item) => sum + item.model.quote(item.elapsed).interest, 0);
  const dailyProfit = positions.reduce((sum, { model }) => {
    const day = (now - model.start) / dayMs;
    return sum + model.quote(day + 1).interest - model.quote(day).interest;
  }, 0);
  const maturityProfit = positions.reduce((sum, { model }) => sum + model.quote(model.duration).result, 0);
  const latestMaturity = positions.reduce((latest, { model }) => Math.max(latest, model.maturity), -Infinity);
  const capital = purchases.reduce((sum, item) => sum + item.quantity * 100, 0);

  return (
    <main className="canvas min-h-screen">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-9 sm:py-11">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[.15em] text-brand uppercase"><span className="h-px w-6 bg-current" /> Obligacje skarbowe</p>
            <h1 className="text-4xl font-bold tracking-[-.065em] sm:text-6xl">Mój <span className="text-brand">portfel.</span></h1>
          </div>
          <button className="action" type="button" aria-expanded={!!formId} onClick={() => setFormId(formId ? "" : crypto.randomUUID())}>{formId ? "Zamknij formularz" : "＋ Dodaj zakup"}</button>
        </div>
        <div className="mb-5 flex flex-wrap items-center gap-4 text-sm">
          <button type="button" className="text-brand underline" onClick={exportPortfolio}>Eksportuj kopię</button>
          <label className="cursor-pointer text-brand underline">Importuj zakupy
            <input className="sr-only" type="file" accept=".json,application/json" onChange={async event => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              try {
                const imported = decodePortfolio(await file.text());
                const merged = new Map(readPortfolio().map(item => [item.id, item]));
                for (const item of imported) if (!merged.has(item.id)) merged.set(item.id, item);
                writePortfolio([...merged.values()]);
                setPurchases(readPortfolio());
                setStorageError("");
              } catch {
                setStorageError("Nie udało się zaimportować pliku. Sprawdź format kopii i dostęp do pamięci przeglądarki.");
              }
            }} />
          </label>
          <p className="text-muted">Dane są zapisane tylko w tej przeglądarce. Wyczyszczenie danych strony usuwa portfel — zachowaj kopię.</p>
        </div>
        {storageError && <p role="alert" className="mb-4 text-sm text-red-800">{storageError}</p>}
        {formId && <PurchaseForm id={formId} today={today} onSave={savePurchase} onSaved={() => setFormId("")} />}
        <section aria-label="Podsumowanie portfela" className="mb-8 grid gap-4 rounded-2xl bg-ink p-5 text-white min-[410px]:grid-cols-2 sm:p-6 lg:grid-cols-4">
          <Metric label="Kapitał zakupów" value={money.format(capital)} summary />
          <div>
            <Metric label="Odsetki brutto do dziś" value={money.format(total)} summary />
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
              <span aria-hidden="true">↗</span>
              <span className="tabular-nums">+{money.format(dailyProfit)}</span>
              <span>brutto dziennie</span>
            </p>
          </div>
          <div>
            <Metric label="Zysk na koniec" value={money.format(maturityProfit)} summary />
            <p className="mt-1 text-xs text-blue-100">
              Najpóźniejszy wykup · {positions.length ? dateLabel.format(latestMaturity) : "—"}
            </p>
          </div>
          <Metric label="Pozycje w portfelu" value={String(purchases.length)} summary />
        </section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold tracking-tight">Zakupione obligacje</h2>
          <div className="flex flex-wrap items-center gap-4">
            {positions.length > 0 && <button type="button" className="cursor-pointer text-sm font-medium text-brand underline underline-offset-4 hover:text-blue-800" onClick={() => setSelectedDays({})}>Resetuj suwaki</button>}
            {positions.length > 0 && <button type="button" className="cursor-pointer text-sm font-medium text-brand underline underline-offset-4 hover:text-blue-800" aria-pressed={editing} onClick={() => setEditing(current => !current)}>{editing ? "Zakończ edycję" : "Edytuj"}</button>}
            <p className="text-sm text-muted">Stan na {dateLabel.format(now)}</p>
          </div>
        </div>
        <div className="grid gap-3">
          {positions.map(item => <BondCard key={item.purchase.id} {...item} editing={editing} selected={selectedDays[item.purchase.id]} onSelect={day => setSelectedDays(current => ({ ...current, [item.purchase.id]: day }))} onDelete={() => deletePurchase(item.purchase)} />)}
          {!positions.length && <div className="panel px-5 py-9 text-center">
            <h3 className="font-semibold">Twój portfel jest pusty</h3>
            <p className="mt-1 text-sm text-muted">Dodaj pierwszy zakup, aby zobaczyć jego oś czasu.</p>
          </div>}
        </div>
        <p className="mt-5 text-xs leading-relaxed text-muted">Kwoty brutto, przy cenie 100 zł za sztukę. Oś pokazuje dzień naliczenia odsetek. Wyceny od drugiego roku dla emisji indeksowanych przyjmują inflację 2,5%.</p>
      </div>
    </main>
  );
}

function Metric({ label, value, summary = false }: { label: string; value: string; summary?: boolean }) {
  return <div>
    <div className={summary ? "text-xs text-blue-100" : "text-xs text-muted"}>{label}</div>
    <strong className={summary ? "text-xl tracking-tight tabular-nums sm:text-3xl" : "text-sm tabular-nums"}>{value}</strong>
  </div>;
}

function PurchaseForm({ id, today, onSave, onSaved }: { id: string; today: string; onSave: (purchase: Purchase) => string; onSaved: () => void }) {
  const [type, setType] = useState<BondType>("TOS");
  const [date, setDate] = useState(today);
  const terms = types[type];
  const known = date.startsWith(offerMonth);
  const [error, submit, pending] = useActionState(async (_previous: string, data: FormData) => {
    const purchase = parsePurchase(data);
    if (typeof purchase === "string") return purchase;
    const result = onSave(purchase);
    if (!result) {
      onSaved();
      return "";
    }
    return result;
  }, "");

  return <form action={submit} className="panel mb-5 grid gap-4 p-5">
    <input type="hidden" name="id" value={id} />
    <div className="grid gap-3 sm:grid-cols-3">
      <label>Typ obligacji<select name="type" value={type} onChange={event => setType(event.target.value as BondType)}>
        {Object.entries(types).map(([code, item]) => <option key={code} value={code}>{code} · {item.label}</option>)}
      </select></label>
      <label>Liczba sztuk<input name="quantity" type="number" min={1} max={100000} defaultValue={10} required /></label>
      <label>Data zakupu<input name="purchasedOn" type="date" min="2000-01-01" max={today} value={date} onChange={event => setDate(event.target.value)} required /></label>
    </div>
    {known ? <p className="text-sm text-muted">Warunki emisji z listopada 2026 · oprocentowanie początkowe {terms.rate / 100}% · opłata do {money.format(terms.fee / 100)} za szt.</p> :
      <div className="grid gap-3 sm:grid-cols-3">
        <label>Oprocentowanie początkowe (%)<input name="rate" inputMode="decimal" required /></label>
        {type !== "TOS" && <label>Marża ponad inflację (p.p.)<input name="margin" inputMode="decimal" required /></label>}
        <label>Opłata za sztukę (zł)<input name="fee" inputMode="decimal" required /></label>
        <p className="text-sm text-muted sm:col-span-3">Wpisz warunki z listu emisyjnego tej serii.</p>
      </div>}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    <button className="action justify-self-start" disabled={pending}>{pending ? "Zapisywanie…" : "Dodaj do portfela"}</button>
  </form>;
}

function BondCard({ purchase, model, elapsed, editing, selected, onSelect, onDelete }: { purchase: Purchase; model: ReturnType<typeof bondModel>; elapsed: number; editing: boolean; selected: number | undefined; onSelect: (day: number) => void; onDelete: () => void }) {
  const terms = types[purchase.type as BondType];
  const percent = (bp: number) => `${(bp / 100).toLocaleString("pl-PL", { maximumFractionDigits: 2 })}%`;
  const day = selected ?? elapsed;
  const quote = model.quote(day);
  const maturityQuote = model.quote(model.duration);
  const date = dateLabel.format(model.start + day * dayMs);
  const breakpoint = model.threshold === null ? 100 : model.threshold / model.duration * 100;
  return <article className="panel p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-brand">{model.series}</span>
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {editing && <button type="button" className="cursor-pointer rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" aria-label={`Usuń zakup ${purchase.type} z ${dateLabel.format(model.start)}, ${purchase.quantity} szt.`} onClick={onDelete}>Usuń</button>}
            <h3 className="font-bold">Obligacje {types[purchase.type as BondType].label}</h3>
          </div>
          <p className="text-xs text-muted">{purchase.quantity} szt. · Kapitał {money.format(purchase.quantity * 100)}{elapsed === model.duration && " · Po terminie wykupu"}</p>
        </div>
      </div>
      <div className="flex grow flex-wrap items-start justify-between gap-x-6 gap-y-2 sm:grow-0">
        <div>
          <p className="text-xs text-muted">Maks. opłata za wcześniejszy wykup</p>
          <strong className="text-sm">{money.format(purchase.feeCents * purchase.quantity / 100)}</strong>
          <span className="ml-2 text-xs text-muted">{money.format(purchase.feeCents / 100)}/szt.</span>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted">Zysk brutto na koniec</p>
          <strong className="text-lg text-brand tabular-nums">{money.format(maturityQuote.result)}</strong>
          {maturityQuote.estimate && <p className="text-xs text-muted">Prognoza</p>}
        </div>
      </div>
    </div>
    <details className="mt-3 rounded-lg border border-line px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-brand">Parametry obligacji i oprocentowanie</summary>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-muted">Data zakupu</dt><dd>{dateLabel.format(model.start)}</dd></div>
        <div><dt className="text-xs text-muted">Termin wykupu</dt><dd>{dateLabel.format(model.maturity)}</dd></div>
        <div><dt className="text-xs text-muted">Wartość nominalna / szt.</dt><dd>{money.format(100)}</dd></div>
        <div><dt className="text-xs text-muted">Opłata za wcześniejszy wykup / szt.</dt><dd>Do {money.format(purchase.feeCents / 100)}</dd></div>
        <div><dt className="text-xs text-muted">Oprocentowanie początkowe</dt><dd>{percent(purchase.rateBp)} rocznie</dd></div>
        <div><dt className="text-xs text-muted">Kolejne lata</dt><dd>{purchase.type === "TOS" ? `Stałe ${percent(purchase.rateBp)} rocznie` : `Inflacja + ${(purchase.marginBp / 100).toLocaleString("pl-PL")} p.p.`}</dd></div>
        <div><dt className="text-xs text-muted">Odsetki</dt><dd>{terms.compounds ? "Kapitalizacja co rok, wypłata przy wykupie" : "Wypłata co rok"}</dd></div>
      </dl>
      {purchase.type !== "TOS" && <p className="mt-3 text-xs leading-relaxed text-muted">Od drugiego roku tabela pokazuje prognozę przy inflacji {percent(assumedInflationBp)}. Dotyczy to także oprocentowania po dwóch latach (w trzecim roku). Faktyczne stawki zależą od inflacji dla danego okresu i nie są tu pobierane.</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Oprocentowanie w kolejnych latach dla zakupu {model.series}</caption>
          <thead className="text-muted"><tr><th scope="col" className="py-2 pr-3 font-medium">Rok</th><th scope="col" className="py-2 pr-3 font-medium">Okres od – do</th><th scope="col" className="py-2 font-medium">Oprocentowanie roczne</th></tr></thead>
          <tbody>{Array.from({ length: terms.years }, (_, year) => {
            const estimated = year > 0 && purchase.type !== "TOS";
            const rate = estimated ? assumedInflationBp + purchase.marginBp : purchase.rateBp;
            return <tr key={year} className="border-t border-line">
              <th scope="row" className="py-2 pr-3 font-medium">{year + 1}.</th>
              <td className="whitespace-nowrap py-2 pr-3">{dateLabel.format(anniversary(model.start, year))} – {dateLabel.format(anniversary(model.start, year + 1))}</td>
              <td className="py-2">{percent(rate)}{estimated && <span className="ml-2 text-muted">prognoza</span>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </details>
    <div className="mt-4 border-t border-line pt-3">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="text-sm font-semibold">Oś czasu</span>
        <span className="text-xs font-medium text-brand">{model.threshold === null ? "Odsetki nie pokrywają pełnej opłaty przed wykupem" : `│ Próg opłacalności brutto · ${dateLabel.format(model.start + model.threshold * dayMs)}`}</span>
      </div>
      <div className="relative">
        <div aria-hidden="true" className="absolute inset-x-2 top-1/2 h-1.5 -translate-y-1/2 rounded-full" style={{ background: `linear-gradient(90deg, #dce2eb ${breakpoint}%, #b7cef7 ${breakpoint}%)` }}>
          {model.threshold !== null && <span className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-brand" style={{ left: `${breakpoint}%` }} />}
        </div>
        <input className="timeline relative block h-10 w-full cursor-ew-resize" type="range" min={0} max={model.duration} value={day} onChange={event => onSelect(Number(event.target.value))} aria-label={`Dzień wyceny ${purchase.type} z ${dateLabel.format(model.start)}`} aria-valuetext={`${date}, odsetki ${money.format(quote.interest)}`} />
      </div>
      <div className="flex flex-wrap justify-between gap-1 text-xs text-muted"><span>Zakup · {dateLabel.format(model.start)}</span><span>Wykup · {dateLabel.format(model.maturity)}</span></div>
      <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-line bg-slate-50 p-3 sm:grid-cols-4">
        <Metric label={quote.estimate ? "Wybrany dzień · prognoza" : "Wybrany dzień"} value={date} />
        <Metric label="Odsetki brutto łącznie" value={money.format(quote.interest)} />
        <Metric label="Opłata w tym dniu" value={money.format(quote.fee)} />
        <Metric label="Zysk brutto po opłacie" value={money.format(quote.result)} />
      </div>
      {quote.paid > 0 && <p className="mt-2 text-xs text-muted">W tym odsetki z zakończonych okresów: {money.format(quote.paid)}</p>}
    </div>
  </article>;
}
