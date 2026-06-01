import { db } from "../server/db";
import { clients } from "../shared/schema";
import { eq } from "drizzle-orm";
import { rankItemsForClient } from "../server/services/morning-brief-service";

async function main() {
  const [row] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.slug, "veterans-benefits-coalition"))
    .limit(1);

  if (!row) {
    console.error("Veterans Benefits Coalition client not found");
    process.exit(1);
  }

  console.error(`VBC clientId: ${row.id}`);
  console.error("Calling rankItemsForClient...");

  const result = await rankItemsForClient(row.id);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
