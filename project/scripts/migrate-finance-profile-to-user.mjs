/**
 * Copies userFinanceProfiles documents into their corresponding users document,
 * now that UserFinanceProfile was merged into the User model.
 *
 * Sets financeProfileCompletedAt on the user so the /first-access gate in
 * dashboard/layout.tsx keeps treating them as onboarded.
 *
 * Does NOT delete the userFinanceProfiles collection — safe to re-run, and
 * leaves the old data in place in case a rollback is needed.
 */

import { MongoClient, ObjectId } from "mongodb";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = resolve(__dirname, "../.env.local");
const envLines = readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI not found in .env.local");

const client = new MongoClient(uri);

async function main() {
  await client.connect();
  const db = client.db();

  const profiles = await db.collection("userFinanceProfiles").find({}).toArray();
  console.log(`Found ${profiles.length} userFinanceProfiles document(s).\n`);

  let migrated = 0;
  let skipped = 0;

  for (const profile of profiles) {
    // users._id is a mix of legacy CUID strings and ObjectIds (predates the
    // migrate-to-objectid.mjs cleanup, which never touched the users collection).
    const update = {
      $set: {
        currency: profile.currency,
        paydayStart: profile.paydayStart ?? null,
        paydayEnd: profile.paydayEnd ?? null,
        notes: profile.notes ?? null,
        financeProfileCompletedAt: profile.updatedAt ?? profile.createdAt ?? new Date(),
      },
    };

    let result = await db.collection("users").updateOne({ _id: profile.userId }, update);

    if (result.matchedCount === 0 && ObjectId.isValid(profile.userId)) {
      result = await db.collection("users").updateOne({ _id: new ObjectId(profile.userId) }, update);
    }

    if (result.matchedCount === 0) {
      console.log(`  skip: no user found for userId ${profile.userId}`);
      skipped += 1;
      continue;
    }

    console.log(`  migrated: user ${profile.userId}`);
    migrated += 1;
  }

  console.log(`\nDone. Migrated ${migrated}, skipped ${skipped}.`);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  client.close();
});
