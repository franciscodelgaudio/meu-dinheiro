/**
 * Migrates documents with legacy CUID string _id values to proper MongoDB ObjectIds.
 *
 * Collections migrated:
 *   - expenseGroups  (references updated in expenseGroupOverrides, expenses, creditCardPurchases)
 *   - savingsAllocations  (no outbound references)
 *   - plannedIncomes      (no outbound references)
 *
 * Safe to re-run: skips collections that have no remaining string _id documents.
 */

import { MongoClient, ObjectId } from "mongodb";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = resolve(__dirname, "../.env.local");
const envLines = readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI not found in .env.local");

const client = new MongoClient(uri);

async function migrateCollection(db, collectionName, referenceUpdaters = []) {
  const col = db.collection(collectionName);
  const docs = await col.find({ _id: { $type: "string" } }).toArray();

  if (docs.length === 0) {
    console.log(`  ${collectionName}: nothing to migrate`);
    return;
  }

  console.log(`  ${collectionName}: migrating ${docs.length} document(s)...`);

  for (const doc of docs) {
    const oldId = doc._id;
    const newId = new ObjectId();

    // Insert with new ObjectId, preserving all other fields
    const { _id, ...rest } = doc;
    let insertedId = newId;
    try {
      await col.insertOne({ _id: newId, ...rest });
    } catch (err) {
      if (err.code === 11000) {
        // A newer ObjectId doc already exists for this unique key — just drop the stale CUID doc
        console.log(`    ${oldId} → (duplicate, dropping stale CUID doc)`);
        await col.deleteOne({ _id: oldId });
        continue;
      }
      throw err;
    }

    // Update references in other collections
    for (const { collection, field } of referenceUpdaters) {
      const refCol = db.collection(collection);
      const result = await refCol.updateMany(
        { [field]: oldId },
        { $set: { [field]: newId.toString() } },
      );
      if (result.modifiedCount > 0) {
        console.log(`    updated ${result.modifiedCount} ${collection}.${field} reference(s)`);
      }
    }

    await col.deleteOne({ _id: oldId });
    console.log(`    ${oldId} → ${insertedId}`);
  }
}

async function main() {
  await client.connect();
  const db = client.db();

  console.log("Starting migration...\n");

  await migrateCollection(db, "expenseGroups", [
    { collection: "expenseGroupOverrides", field: "expenseGroupId" },
    { collection: "expenses",              field: "expenseGroupId" },
    { collection: "creditCardPurchases",   field: "expenseGroupId" },
  ]);

  await migrateCollection(db, "savingsAllocations");
  await migrateCollection(db, "plannedIncomes");

  console.log("\nMigration complete.");
  await client.close();
}

main().catch((err) => {
  console.error(err);
  client.close();
  process.exit(1);
});
