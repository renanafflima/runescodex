/**
 * Applies to an isolated Postgres (all migrations) and verifies Charm Guide schema + flows.
 * Usage:
 *   DATABASE_URL=postgresql://runescodex:runescodex_dev@localhost:5432/runescodex_migration_validate \
 *   node scripts/validate-charm-guides-migration.mjs
 */
import { execSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const EXPECTED_TABLES = [
  "CharmGuide",
  "CharmGuideStep",
  "CharmGuideStepCreature",
  "CharmGuideLike",
  "CharmGuideFavorite",
  "CharmGuideComment",
  "CharmGuideCommentLike",
  "CharmGuideCreatureProgress",
  "CharmGuidePublishIdempotency",
];

const EXPECTED_ENUMS = [
  "CharmGuideStatus",
  "CharmGuideCpCategory",
  "CharmGuideDifficulty",
];

function runPrismaMigrateDeploy() {
  execSync("npx prisma migrate deploy", {
    cwd: new URL("..", import.meta.url),
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

async function verifySchema(client) {
  const tables = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[]) ORDER BY 1`,
    [EXPECTED_TABLES],
  );
  const foundTables = tables.rows.map((row) => row.tablename);
  const missingTables = EXPECTED_TABLES.filter((name) => !foundTables.includes(name));
  if (missingTables.length) {
    throw new Error(`Missing tables: ${missingTables.join(", ")}`);
  }

  const enums = await client.query(
    `SELECT t.typname
     FROM pg_type t
     JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public' AND t.typtype = 'e' AND t.typname = ANY($1::text[])
     ORDER BY 1`,
    [EXPECTED_ENUMS],
  );
  const foundEnums = enums.rows.map((row) => row.typname);
  const missingEnums = EXPECTED_ENUMS.filter((name) => !foundEnums.includes(name));
  if (missingEnums.length) {
    throw new Error(`Missing enums: ${missingEnums.join(", ")}`);
  }

  const ticketEnum = await client.query(
    `SELECT 1
     FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'TicketProblemType' AND e.enumlabel = 'CHARM_GUIDE'`,
  );
  if (ticketEnum.rowCount !== 1) {
    throw new Error("TicketProblemType.CHARM_GUIDE missing.");
  }

  const ticketColumn = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = 'Ticket' AND column_name = 'charmGuideId'`,
  );
  if (ticketColumn.rowCount !== 1) {
    throw new Error("Ticket.charmGuideId column missing.");
  }

  const fks = await client.query(
    `SELECT c.conname
     FROM pg_constraint c
     JOIN pg_class rel ON rel.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = rel.relnamespace
     WHERE c.contype = 'f'
       AND n.nspname = 'public'
       AND rel.relname LIKE 'CharmGuide%'`,
  );
  if (fks.rowCount < 10) {
    throw new Error(`Expected FK constraints on CharmGuide*, found ${fks.rowCount}.`);
  }

  const indexes = await client.query(
    `SELECT indexname FROM pg_indexes
     WHERE schemaname = 'public' AND tablename LIKE 'CharmGuide%'`,
  );
  if (indexes.rowCount < 15) {
    throw new Error(`Expected CharmGuide indexes, found ${indexes.rowCount}.`);
  }

  return {
    tables: foundTables.length,
    enums: foundEnums.length,
    foreignKeys: fks.rowCount,
    indexes: indexes.rowCount,
  };
}

async function verifyFlows(client) {
  const userId = randomUUID();
  const adminId = randomUUID();
  const characterId = randomUUID();
  const creatureA = randomUUID();
  const creatureB = randomUUID();
  const huntId = randomUUID();
  const guideId = randomUUID();
  const stepId = randomUUID();
  const ticketId = randomUUID();
  const now = new Date();

  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO "User" (id, email, "passwordHash", role, "createdAt", "updatedAt")
       VALUES
         ($1, 'validator-user@test', 'hash', 'USER', $3, $3),
         ($2, 'validator-admin@test', 'hash', 'ADMIN', $3, $3)`,
      [userId, adminId, now],
    );
    await client.query(
      `INSERT INTO "Character" (id, "userId", name, vocation, level, world, "createdAt", "updatedAt")
       VALUES ($1, $2, 'Validator', 'EK', 400, 'Test', $3, $3)`,
      [characterId, userId, now],
    );
    await client.query(
      `INSERT INTO "Creature" (id, slug, name, image, difficulty, "isActive", "createdAt", "updatedAt")
       VALUES
         ($1, 'creature-a', 'Creature A', 'a.gif', 'EASY', true, $3, $3),
         ($2, 'creature-b', 'Creature B', 'b.gif', 'EASY', true, $3, $3)`,
      [creatureA, creatureB, now],
    );
    await client.query(
      `INSERT INTO "BestiaryEntry" (id, "creatureId", "charmPoints", "killsRequired", "createdAt", "updatedAt")
       VALUES ($1, $2, 15, 500, $3, $3), ($4, $5, 25, 500, $3, $3)`,
      [randomUUID(), creatureA, now, randomUUID(), creatureB],
    );
    await client.query(
      `INSERT INTO "Hunt" (id, slug, name, location, difficulty, "isActive", "createdAt", "updatedAt")
       VALUES ($1, 'hunt-a', 'Hunt A', 'Test', 'EASY', true, $2, $2)`,
      [huntId, now],
    );

    await client.query(
      `INSERT INTO "CharmGuide"
       (id, "userId", title, description, "cpCategory", difficulty, status,
        "totalCharmPoints", "uniqueCreatureCount", "stepCount", "createdAt", "updatedAt")
       VALUES ($1, $2, 'Guia validação', 'Fluxo integrado de validação', 'CP_100', 'EASY', 'DRAFT', 40, 2, 1, $3, $3)`,
      [guideId, userId, now],
    );
    await client.query(
      `INSERT INTO "CharmGuideStep" (id, "guideId", position, "huntId", "createdAt", "updatedAt")
       VALUES ($1, $2, 1, $3, $4, $4)`,
      [stepId, guideId, huntId, now],
    );
    await client.query(
      `INSERT INTO "CharmGuideStepCreature" (id, "stepId", "creatureId", position)
       VALUES ($1, $2, $3, 1), ($4, $2, $5, 2)`,
      [randomUUID(), stepId, creatureA, randomUUID(), creatureB],
    );

    await client.query(
      `UPDATE "CharmGuide" SET status = 'PENDING_REVIEW', "updatedAt" = $2 WHERE id = $1`,
      [guideId, now],
    );
    await client.query(
      `INSERT INTO "Ticket"
       (id, protocol, "authorId", status, "problemType", impact, origin, description, "charmGuideId", "createdAt", "updatedAt")
       VALUES ($1, 'RC-VAL-1', $2, 'OPEN', 'CHARM_GUIDE', 'MEDIUM', 'BESTIARY', 'Validação', $3, $4, $4)`,
      [ticketId, userId, guideId, now],
    );

    await client.query(
      `UPDATE "CharmGuide" SET status = 'PUBLISHED', "publishedAt" = $2, "moderatedByUserId" = $3, "moderatedAt" = $2, "updatedAt" = $2
       WHERE id = $1`,
      [guideId, now, adminId],
    );
    await client.query(
      `UPDATE "Ticket" SET status = 'RESOLVED', "resolvedAt" = $2, "resolvedByUserId" = $3, "updatedAt" = $2 WHERE id = $1`,
      [ticketId, now, adminId],
    );

    await client.query(
      `INSERT INTO "CharmGuideLike" (id, "guideId", "userId", "createdAt") VALUES ($1, $2, $3, $4)`,
      [randomUUID(), guideId, userId, now],
    );
    await client.query(
      `INSERT INTO "CharmGuideFavorite" (id, "guideId", "userId", "createdAt") VALUES ($1, $2, $3, $4)`,
      [randomUUID(), guideId, userId, now],
    );
    const commentId = randomUUID();
    await client.query(
      `INSERT INTO "CharmGuideComment"
       (id, "guideId", "userId", content, "isEdited", "isDeleted", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'Comentário de validação', false, false, $4, $4)`,
      [commentId, guideId, userId, now],
    );
    await client.query(
      `INSERT INTO "CharmGuideCreatureProgress"
       (id, "userId", "characterId", "guideId", "creatureId", "completedAt")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), userId, characterId, guideId, creatureA, now],
    );
    const idemKey = `validate:${createHash("sha256").update(guideId).digest("hex").slice(0, 16)}`;
    await client.query(
      `INSERT INTO "CharmGuidePublishIdempotency"
       (id, "userId", "idempotencyKey", "payloadHash", "guideId", "ticketId", "createdAt")
       VALUES ($1, $2, $3, 'hash', $4, $5, $6)`,
      [randomUUID(), userId, idemKey, guideId, ticketId, now],
    );

    const uniqueCp = await client.query(
      `SELECT c.id, b."charmPoints"
       FROM "CharmGuideStepCreature" sc
       JOIN "Creature" c ON c.id = sc."creatureId"
       JOIN "BestiaryEntry" b ON b."creatureId" = c.id
       JOIN "CharmGuideStep" s ON s.id = sc."stepId"
       WHERE s."guideId" = $1`,
      [guideId],
    );
    const byCreature = new Map();
    for (const row of uniqueCp.rows) {
      if (!byCreature.has(row.id)) byCreature.set(row.id, Number(row.charmPoints));
    }
    const points = [...byCreature.values()].reduce((sum, value) => sum + value, 0);
    if (points !== 40) {
      throw new Error(`Expected 40 unique CP, got ${points}.`);
    }

    await client.query("ROLLBACK");
    return {
      uniqueCharmPoints: points,
      uniqueCreatures: byCreature.size,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

const client = new pg.Client({ connectionString: databaseUrl });
try {
  console.log("Applying Prisma migrations (isolated database)...");
  runPrismaMigrateDeploy();
  await client.connect();
  console.log("Verifying schema...");
  const schema = await verifySchema(client);
  console.log("Running transactional flow checks...");
  const flows = await verifyFlows(client);
  console.log(
    JSON.stringify(
      {
        ok: true,
        database: databaseUrl.replace(/:[^:@/]+@/, ":***@"),
        schema,
        flows,
        migration: "20261110120000_charm_guides",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
