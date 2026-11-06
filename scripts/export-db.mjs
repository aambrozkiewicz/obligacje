import { DatabaseSync } from "node:sqlite";
import { writeFileSync } from "node:fs";

// One-time migration; the old database is opened read-only and never deployed.
const db = new DatabaseSync("prisma/portfolio.db", { readOnly: true });
try {
  const purchases = db.prepare('SELECT id, type, purchasedOn, quantity, rateBp, marginBp, feeCents FROM "Purchase"').all();
  const file = `portfel-backup-${Date.now()}.json`;
  writeFileSync(file, JSON.stringify(purchases, null, 2), { flag: "wx", mode: 0o600 });
  console.log(`Zapisano ${purchases.length} zakupów do ${file}. Zaimportuj plik w aplikacji.`);
} finally {
  db.close();
}
