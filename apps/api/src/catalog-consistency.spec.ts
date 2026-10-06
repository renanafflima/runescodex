import { readFileSync } from 'fs';
import { join } from 'path';

const schema = readFileSync(join(__dirname, '../prisma/schema.prisma'), 'utf8');
const emMigration = readFileSync(
  join(
    __dirname,
    '../prisma/migrations/20261001061700_add_em_to_vocation/migration.sql',
  ),
  'utf8',
);
const catalogMigration = readFileSync(
  join(
    __dirname,
    '../prisma/migrations/20260915120000_add_creatures_hunts_bestiary/migration.sql',
  ),
  'utf8',
);

function enumValues(name: string) {
  const match = schema.match(new RegExp(`enum ${name} \\{([^}]+)\\}`));
  if (!match) {
    throw new Error(`enum ${name} not found`);
  }
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('/') && !line.startsWith('*'));
}

describe('catalog schema consistency', () => {
  it('keeps Vocation aligned with the non-destructive EM migration', () => {
    expect(enumValues('Vocation')).toEqual(['EK', 'RP', 'ED', 'MS', 'EM']);
    expect(emMigration).toContain(`ADD VALUE IF NOT EXISTS 'EM'`);
    expect(emMigration).not.toMatch(/\b(DROP|DELETE|TRUNCATE)\b/i);
  });

  it('keeps Difficulty values shared by Hunt and Creature', () => {
    expect(enumValues('Difficulty')).toEqual([
      'EASY',
      'MEDIUM',
      'HARD',
      'VERY_HARD',
    ]);
  });

  it('declares HuntVocation and HuntCreature foreign keys', () => {
    expect(schema).toContain('model HuntVocation');
    expect(schema).toContain(
      'hunt           Hunt        @relation(fields: [huntId], references: [id], onDelete: Cascade)',
    );
    expect(schema).toContain('@@unique([huntId, vocation])');
    expect(schema).toContain('model HuntCreature');
    expect(schema).toContain(
      'creature         Creature     @relation(fields: [creatureId], references: [id], onDelete: Restrict)',
    );
    expect(schema).toContain('@@unique([huntId, creatureId])');
    expect(catalogMigration).toContain(
      'CREATE UNIQUE INDEX "HuntVocation_huntId_vocation_key"',
    );
    expect(catalogMigration).toContain(
      'CREATE UNIQUE INDEX "HuntCreature_huntId_creatureId_key"',
    );
    expect(schema).toContain('bestiaryEntry     BestiaryEntry?');
  });
});
