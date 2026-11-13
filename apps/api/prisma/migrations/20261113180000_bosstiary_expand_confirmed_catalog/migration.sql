-- Bosstiary: insert confirmed wiki bosses (idempotent). Does not UPDATE existing rows.
-- Source: scripts/bosstiary-catalog-final-validation.json (295 of 297; excludes owin/first-dragon).
BEGIN;

INSERT INTO "BosstiaryBoss" ("id", "slug", "name", "officialCategory", "accessStatus", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.slug, v.name, v."officialCategory", 'UNKNOWN'::"BosstiaryAccessStatus", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('adlerauge', 'Adlerauge', 'Bane'),
  ('adventurer-group', 'Adventurer Group', 'Archfoe'),
  ('ahau', 'Ahau', 'Archfoe'),
  ('alptramun', 'Alptramun', 'Nemesis'),
  ('amenef-the-burning', 'Amenef The Burning', 'Archfoe'),
  ('ancient-spawn-of-morgathla', 'Ancient Spawn of Morgathla', 'Archfoe'),
  ('anmothra', 'Anmothra', 'Nemesis'),
  ('annihilon', 'Annihilon', 'Bane'),
  ('anomaly', 'Anomaly', 'Archfoe'),
  ('arachir-the-ancient-one', 'Arachir the Ancient One', 'Nemesis'),
  ('arbaziloth', 'Arbaziloth', 'Archfoe'),
  ('arthei', 'Arthei', 'Bane'),
  ('arthom-the-hunter', 'Arthom the Hunter', 'Nemesis'),
  ('ashmunrah', 'Ashmunrah', 'Bane'),
  ('atab', 'Atab', 'Bane'),
  ('ayana-the-crimson-curse', 'Ayana the Crimson Curse', 'Archfoe'),
  ('bakragore', 'Bakragore', 'Nemesis'),
  ('bane-lord', 'Bane Lord', 'Nemesis'),
  ('barbaria', 'Barbaria', 'Nemesis'),
  ('battlemaster-zunzu', 'Battlemaster Zunzu', 'Nemesis'),
  ('bibby-bloodbath', 'Bibby Bloodbath', 'Archfoe'),
  ('big-boss-trolliver', 'Big Boss Trolliver', 'Nemesis'),
  ('black-vixen', 'Black Vixen', 'Archfoe'),
  ('blight-mariner', 'Blight Mariner', 'Archfoe'),
  ('bloodback', 'Bloodback', 'Archfoe')
) AS v(slug, name, "officialCategory")
WHERE NOT EXISTS (SELECT 1 FROM "BosstiaryBoss" b WHERE b.slug = v.slug);

INSERT INTO "BosstiaryBoss" ("id", "slug", "name", "officialCategory", "accessStatus", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.slug, v.name, v."officialCategory", 'UNKNOWN'::"BosstiaryAccessStatus", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('bone-overlord', 'Bone Overlord', 'Archfoe'),
  ('boogey', 'Boogey', 'Bane'),
  ('boreth', 'Boreth', 'Bane'),
  ('brain-head', 'Brain Head', 'Archfoe'),
  ('brokul', 'Brokul', 'Archfoe'),
  ('bullwark', 'Bullwark', 'Bane'),
  ('burster', 'Burster', 'Nemesis'),
  ('captain-jones', 'Captain Jones', 'Nemesis'),
  ('chagorz', 'Chagorz', 'Archfoe'),
  ('chikhaton', 'Chikhaton', 'Nemesis'),
  ('chizzoron-the-distorter', 'Chizzoron the Distorter', 'Nemesis'),
  ('chopper', 'Chopper', 'Bane'),
  ('clavius', 'Clavius', 'Bane'),
  ('countess-sorrow', 'Countess Sorrow', 'Nemesis'),
  ('court-warlock', 'Court Warlock', 'Archfoe'),
  ('cublarc-the-plunderer', 'Cublarc the Plunderer', 'Nemesis'),
  ('custodian', 'Custodian', 'Bane'),
  ('darkfang', 'Darkfang', 'Archfoe'),
  ('dazed-leaf-golem', 'Dazed Leaf Golem', 'Bane'),
  ('death-priest-shargon', 'Death Priest Shargon', 'Bane'),
  ('deep-terror', 'Deep Terror', 'Bane'),
  ('devovorga', 'Devovorga', 'Nemesis'),
  ('dharalion', 'Dharalion', 'Nemesis'),
  ('diblis-the-fair', 'Diblis the Fair', 'Nemesis'),
  ('dipthrah', 'Dipthrah', 'Bane')
) AS v(slug, name, "officialCategory")
WHERE NOT EXISTS (SELECT 1 FROM "BosstiaryBoss" b WHERE b.slug = v.slug);

INSERT INTO "BosstiaryBoss" ("id", "slug", "name", "officialCategory", "accessStatus", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.slug, v.name, v."officialCategory", 'UNKNOWN'::"BosstiaryAccessStatus", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('dirtbeard', 'Dirtbeard', 'Bane'),
  ('diseased-bill', 'Diseased Bill', 'Bane'),
  ('diseased-dan', 'Diseased Dan', 'Bane'),
  ('diseased-fred', 'Diseased Fred', 'Bane'),
  ('doctor-perhaps', 'Doctor Perhaps', 'Bane'),
  ('dracola', 'Dracola', 'Nemesis'),
  ('dragon-pack', 'Dragon Pack', 'Archfoe'),
  ('dreadful-disruptor', 'Dreadful Disruptor', 'Nemesis'),
  ('dreadmaw', 'Dreadmaw', 'Nemesis'),
  ('earl-osam', 'Earl Osam', 'Archfoe'),
  ('ekatrix', 'Ekatrix', 'Archfoe'),
  ('eldritch-dragon-lord', 'Eldritch Dragon Lord', 'Archfoe'),
  ('elvira-hammerthrust', 'Elvira Hammerthrust', 'Nemesis'),
  ('enusat-the-onyx-wing', 'Enusat The Onyx Wing', 'Bane'),
  ('eradicator', 'Eradicator', 'Archfoe'),
  ('essence-of-malice', 'Essence Of Malice', 'Archfoe'),
  ('evil-mastermind', 'Evil Mastermind', 'Bane'),
  ('faceless-bane', 'Faceless Bane', 'Archfoe'),
  ('feroxa-mortal', 'Feroxa (Mortal)', 'Nemesis'),
  ('ferumbras', 'Ferumbras', 'Nemesis'),
  ('ferumbras-mortal-shell', 'Ferumbras Mortal Shell', 'Nemesis'),
  ('flamecaller-zazrak', 'Flamecaller Zazrak', 'Nemesis'),
  ('fleabringer', 'Fleabringer', 'Nemesis'),
  ('fleshslicer', 'Fleshslicer', 'Bane'),
  ('foreman-kneebiter', 'Foreman Kneebiter', 'Nemesis')
) AS v(slug, name, "officialCategory")
WHERE NOT EXISTS (SELECT 1 FROM "BosstiaryBoss" b WHERE b.slug = v.slug);

INSERT INTO "BosstiaryBoss" ("id", "slug", "name", "officialCategory", "accessStatus", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.slug, v.name, v."officialCategory", 'UNKNOWN'::"BosstiaryAccessStatus", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('furyosa', 'Furyosa', 'Nemesis'),
  ('gaffir', 'Gaffir', 'Bane'),
  ('gazharagoth', 'Gaz''Haragoth', 'Nemesis'),
  ('gelidrazah-the-frozen', 'Gelidrazah the Frozen', 'Archfoe'),
  ('general-murius', 'General Murius', 'Nemesis'),
  ('ghazbaran', 'Ghazbaran', 'Nemesis'),
  ('ghulosh', 'Ghulosh', 'Archfoe'),
  ('glitterscale', 'Glitterscale', 'Bane'),
  ('glooth-fairy', 'Glooth Fairy', 'Bane'),
  ('golgordan', 'Golgordan', 'Bane'),
  ('gorga', 'Gorga', 'Bane'),
  ('gorzindel', 'Gorzindel', 'Archfoe'),
  ('goshnars-cruelty', 'Goshnar''s Cruelty', 'Archfoe'),
  ('goshnars-greed', 'Goshnar''s Greed', 'Archfoe'),
  ('goshnars-hatred', 'Goshnar''s Hatred', 'Archfoe'),
  ('goshnars-malice', 'Goshnar''s Malice', 'Archfoe'),
  ('goshnars-megalomania', 'Goshnar''s Megalomania', 'Nemesis'),
  ('goshnars-spite', 'Goshnar''s Spite', 'Archfoe'),
  ('gralvalon', 'Gralvalon', 'Bane'),
  ('grand-canon-dominus', 'Grand Canon Dominus', 'Bane'),
  ('grand-chaplain-gaunder', 'Grand Chaplain Gaunder', 'Bane'),
  ('grand-commander-soeren', 'Grand Commander Soeren', 'Bane'),
  ('grand-mother-foulscale', 'Grand Mother Foulscale', 'Nemesis'),
  ('grandfather-tridian', 'Grandfather Tridian', 'Nemesis'),
  ('gravelord-oshuran', 'Gravelord Oshuran', 'Nemesis')
) AS v(slug, name, "officialCategory")
WHERE NOT EXISTS (SELECT 1 FROM "BosstiaryBoss" b WHERE b.slug = v.slug);

INSERT INTO "BosstiaryBoss" ("id", "slug", "name", "officialCategory", "accessStatus", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.slug, v.name, v."officialCategory", 'UNKNOWN'::"BosstiaryAccessStatus", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('groam', 'Groam', 'Nemesis'),
  ('grorlam', 'Grorlam', 'Nemesis'),
  ('guard-captain-quaid', 'Guard Captain Quaid', 'Bane'),
  ('hairman-the-huge', 'Hairman The Huge', 'Nemesis'),
  ('hellgorak', 'Hellgorak', 'Bane'),
  ('heoni', 'Heoni', 'Bane'),
  ('herald-of-fire', 'Herald of Fire', 'Bane'),
  ('high-templar-cobrass', 'High Templar Cobrass', 'Nemesis'),
  ('hirintror', 'Hirintror', 'Nemesis'),
  ('horestis', 'Horestis', 'Nemesis'),
  ('ice-horror', 'Ice Horror', 'Archfoe'),
  ('ichgahal', 'Ichgahal', 'Archfoe'),
  ('inkwing', 'Inkwing', 'Bane'),
  ('irahsae', 'Irahsae', 'Nemesis'),
  ('irgix-the-flimsy', 'Irgix the Flimsy', 'Archfoe'),
  ('izcandar-champion-of-summer', 'Izcandar Champion of Summer', 'Nemesis'),
  ('izcandar-champion-of-winter', 'Izcandar Champion of Winter', 'Nemesis'),
  ('izcandar-the-banished', 'Izcandar the Banished', 'Nemesis'),
  ('jailer', 'Jailer', 'Bane'),
  ('jaul', 'Jaul', 'Bane'),
  ('jesse-the-wicked', 'Jesse the Wicked', 'Nemesis'),
  ('kalyassa', 'Kalyassa', 'Archfoe'),
  ('katex-blood-tongue', 'Katex Blood Tongue', 'Archfoe'),
  ('king-chuck', 'King Chuck', 'Nemesis'),
  ('king-zelos', 'King Zelos', 'Archfoe')
) AS v(slug, name, "officialCategory")
WHERE NOT EXISTS (SELECT 1 FROM "BosstiaryBoss" b WHERE b.slug = v.slug);

INSERT INTO "BosstiaryBoss" ("id", "slug", "name", "officialCategory", "accessStatus", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.slug, v.name, v."officialCategory", 'UNKNOWN'::"BosstiaryAccessStatus", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('kusuma', 'Kusuma', 'Archfoe'),
  ('lady-tenebris', 'Lady Tenebris', 'Archfoe'),
  ('latrivan', 'Latrivan', 'Bane'),
  ('lersatio', 'Lersatio', 'Bane'),
  ('lisa', 'Lisa', 'Bane'),
  ('lizard-gate-guardian', 'Lizard Gate Guardian', 'Nemesis'),
  ('lloyd', 'Lloyd', 'Archfoe'),
  ('lokathmor', 'Lokathmor', 'Archfoe'),
  ('lord-of-the-elements', 'Lord of the Elements', 'Archfoe'),
  ('lord-retro', 'Lord Retro', 'Archfoe'),
  ('mad-mage', 'Mad Mage', 'Bane'),
  ('madareth', 'Madareth', 'Bane'),
  ('magma-bubble', 'Magma Bubble', 'Archfoe'),
  ('mahatheb', 'Mahatheb', 'Nemesis'),
  ('mahrdis', 'Mahrdis', 'Bane'),
  ('maior-domus', 'Maior Domus', 'Archfoe'),
  ('malofur-mangrinder', 'Malofur Mangrinder', 'Nemesis'),
  ('malvaroth', 'Malvaroth', 'Bane'),
  ('man-in-the-cave', 'Man In The Cave', 'Nemesis'),
  ('marziel', 'Marziel', 'Bane'),
  ('massacre', 'Massacre', 'Nemesis'),
  ('maw', 'Maw', 'Bane'),
  ('mawhawk', 'Mawhawk', 'Archfoe'),
  ('maxxenius', 'Maxxenius', 'Nemesis'),
  ('mazzinor', 'Mazzinor', 'Archfoe')
) AS v(slug, name, "officialCategory")
WHERE NOT EXISTS (SELECT 1 FROM "BosstiaryBoss" b WHERE b.slug = v.slug);

INSERT INTO "BosstiaryBoss" ("id", "slug", "name", "officialCategory", "accessStatus", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.slug, v.name, v."officialCategory", 'UNKNOWN'::"BosstiaryAccessStatus", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('megasylvan-yselda', 'Megasylvan Yselda', 'Archfoe'),
  ('melting-frozen-horror', 'Melting Frozen Horror', 'Archfoe'),
  ('mephiles', 'Mephiles', 'Bane'),
  ('michael-the-stalwart', 'Michael the Stalwart', 'Bane'),
  ('mimar-haffar', 'Mimar Haffar', 'Archfoe'),
  ('mindmasher', 'Mindmasher', 'Bane'),
  ('mitmah-vanguard', 'Mitmah Vanguard', 'Archfoe'),
  ('monstor', 'Monstor', 'Bane'),
  ('morgaroth', 'Morgaroth', 'Nemesis'),
  ('morguthis', 'Morguthis', 'Bane'),
  ('mornenion', 'Mornenion', 'Nemesis'),
  ('morshabaal', 'Morshabaal', 'Nemesis'),
  ('mozradek', 'Mozradek', 'Bane'),
  ('mr-punish', 'Mr. Punish', 'Nemesis'),
  ('murcion', 'Murcion', 'Archfoe'),
  ('neferi-the-spy', 'Neferi The Spy', 'Archfoe'),
  ('obujos', 'Obujos', 'Bane'),
  ('ocyakao', 'Ocyakao', 'Nemesis'),
  ('omrafir', 'Omrafir', 'Nemesis'),
  ('omruc', 'Omruc', 'Bane'),
  ('oodok-witchmaster', 'Oodok Witchmaster', 'Nemesis'),
  ('orshabaal', 'Orshabaal', 'Nemesis'),
  ('outburst', 'Outburst', 'Archfoe'),
  ('overseer-osverger', 'Overseer Osverger', 'Bane'),
  ('phosphorus', 'Phosphorus', 'Nemesis')
) AS v(slug, name, "officialCategory")
WHERE NOT EXISTS (SELECT 1 FROM "BosstiaryBoss" b WHERE b.slug = v.slug);

INSERT INTO "BosstiaryBoss" ("id", "slug", "name", "officialCategory", "accessStatus", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.slug, v.name, v."officialCategory", 'UNKNOWN'::"BosstiaryAccessStatus", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('phrodomo', 'Phrodomo', 'Nemesis'),
  ('plagirath', 'Plagirath', 'Archfoe'),
  ('plagueroot', 'Plagueroot', 'Nemesis'),
  ('preceptor-lazare', 'Preceptor Lazare', 'Bane'),
  ('professor-maxxen', 'Professor Maxxen', 'Bane'),
  ('raging-mage', 'Raging Mage', 'Archfoe'),
  ('rahemos', 'Rahemos', 'Bane'),
  ('rakesh-moonfang', 'Rakesh Moonfang', 'Bane'),
  ('ratmiral-blackwhiskers', 'Ratmiral Blackwhiskers', 'Archfoe'),
  ('ravenous-hunger', 'Ravenous Hunger', 'Archfoe'),
  ('raxias', 'Raxias', 'Nemesis'),
  ('razzagorn', 'Razzagorn', 'Archfoe'),
  ('realityquake', 'Realityquake', 'Archfoe'),
  ('robby-the-reckless', 'Robby the Reckless', 'Nemesis'),
  ('rotrender', 'Rotrender', 'Nemesis'),
  ('rotspit', 'Rotspit', 'Bane'),
  ('rotworm-queen', 'Rotworm Queen', 'Nemesis'),
  ('rukor-zad', 'Rukor Zad', 'Nemesis'),
  ('rupture', 'Rupture', 'Archfoe'),
  ('shadowpelt', 'Shadowpelt', 'Archfoe'),
  ('shadowstalker', 'Shadowstalker', 'Bane'),
  ('sharpclaw', 'Sharpclaw', 'Archfoe'),
  ('shlorg', 'Shlorg', 'Nemesis'),
  ('shulgrax', 'Shulgrax', 'Archfoe'),
  ('sir-baeloc', 'Sir Baeloc', 'Archfoe')
) AS v(slug, name, "officialCategory")
WHERE NOT EXISTS (SELECT 1 FROM "BosstiaryBoss" b WHERE b.slug = v.slug);

INSERT INTO "BosstiaryBoss" ("id", "slug", "name", "officialCategory", "accessStatus", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.slug, v.name, v."officialCategory", 'UNKNOWN'::"BosstiaryAccessStatus", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('sir-leonard', 'Sir Leonard', 'Bane'),
  ('sir-leopold', 'Sir Leopold', 'Nemesis'),
  ('sir-valorcrest', 'Sir Valorcrest', 'Nemesis'),
  ('sister-hetai', 'Sister Hetai', 'Archfoe'),
  ('smuggler-baron-silvertoe', 'Smuggler Baron Silvertoe', 'Nemesis'),
  ('soul-of-dragonking-zyrtarch', 'Soul of Dragonking Zyrtarch', 'Archfoe'),
  ('srezz-yellow-eyes', 'Srezz Yellow Eyes', 'Archfoe'),
  ('sugar-daddy', 'Sugar Daddy', 'Bane'),
  ('sugar-mommy', 'Sugar Mommy', 'Bane'),
  ('tamru-the-black', 'Tamru the Black', 'Archfoe'),
  ('tanjis', 'Tanjis', 'Bane'),
  ('tarbaz', 'Tarbaz', 'Archfoe'),
  ('tazhadur', 'Tazhadur', 'Archfoe'),
  ('teneshpar', 'Teneshpar', 'Nemesis'),
  ('thaian', 'Thaian', 'Archfoe'),
  ('thalas', 'Thalas', 'Bane'),
  ('thawing-dragon-lord', 'Thawing Dragon Lord', 'Bane'),
  ('the-abomination', 'The Abomination', 'Nemesis'),
  ('the-baron-from-below', 'The Baron from Below', 'Bane'),
  ('the-big-bad-one', 'The Big Bad One', 'Nemesis'),
  ('the-blazing-rose', 'The Blazing Rose', 'Archfoe'),
  ('the-blightfather', 'The Blightfather', 'Nemesis'),
  ('the-brainstealer', 'The Brainstealer', 'Archfoe'),
  ('the-count-of-the-core', 'The Count Of The Core', 'Bane'),
  ('the-diamond-blossom', 'The Diamond Blossom', 'Archfoe')
) AS v(slug, name, "officialCategory")
WHERE NOT EXISTS (SELECT 1 FROM "BosstiaryBoss" b WHERE b.slug = v.slug);

INSERT INTO "BosstiaryBoss" ("id", "slug", "name", "officialCategory", "accessStatus", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.slug, v.name, v."officialCategory", 'UNKNOWN'::"BosstiaryAccessStatus", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('the-dread-maiden', 'The Dread Maiden', 'Archfoe'),
  ('the-duke-of-the-depths', 'The Duke Of The Depths', 'Bane'),
  ('the-enraged-thorn-knight', 'The Enraged Thorn Knight', 'Archfoe'),
  ('the-evil-eye', 'The Evil Eye', 'Nemesis'),
  ('the-false-god', 'The False God', 'Archfoe'),
  ('the-fear-feaster', 'The Fear Feaster', 'Archfoe'),
  ('the-flaming-orchid', 'The Flaming Orchid', 'Archfoe'),
  ('the-frog-prince', 'The Frog Prince', 'Nemesis'),
  ('the-gravedigger', 'The Gravedigger', 'Archfoe'),
  ('the-handmaiden', 'The Handmaiden', 'Nemesis'),
  ('the-hungerer', 'The Hungerer', 'Nemesis'),
  ('the-imperor', 'The Imperor', 'Nemesis'),
  ('the-last-lore-keeper', 'The Last Lore Keeper', 'Nemesis'),
  ('the-lily-of-night', 'The Lily Of Night', 'Archfoe'),
  ('the-lord-of-the-lice', 'The Lord of the Lice', 'Bane'),
  ('the-manhunter', 'The Manhunter', 'Nemesis'),
  ('the-mean-masher', 'The Mean Masher', 'Nemesis'),
  ('the-mega-magmaoid', 'The Mega Magmaoid', 'Archfoe'),
  ('the-monster', 'The Monster', 'Archfoe'),
  ('the-moonlight-aster', 'The Moonlight Aster', 'Archfoe'),
  ('the-moonsnow-magnolia', 'The Moonsnow Magnolia', 'Archfoe'),
  ('the-mutated-pumpkin', 'The Mutated Pumpkin', 'Nemesis'),
  ('the-nightmare-beast', 'The Nightmare Beast', 'Archfoe'),
  ('the-old-whopper', 'The Old Whopper', 'Nemesis'),
  ('the-pale-count', 'The Pale Count', 'Nemesis')
) AS v(slug, name, "officialCategory")
WHERE NOT EXISTS (SELECT 1 FROM "BosstiaryBoss" b WHERE b.slug = v.slug);

INSERT INTO "BosstiaryBoss" ("id", "slug", "name", "officialCategory", "accessStatus", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.slug, v.name, v."officialCategory", 'UNKNOWN'::"BosstiaryAccessStatus", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('the-pale-worm', 'The Pale Worm', 'Archfoe'),
  ('the-percht-queen', 'The Percht Queen', 'Nemesis'),
  ('the-plasmother', 'The Plasmother', 'Nemesis'),
  ('the-ravager', 'The Ravager', 'Bane'),
  ('the-rootkraken', 'The Rootkraken', 'Archfoe'),
  ('the-sandking', 'The Sandking', 'Archfoe'),
  ('the-scourge-of-oblivion', 'The Scourge of Oblivion', 'Archfoe'),
  ('the-shatterer', 'The Shatterer', 'Bane'),
  ('the-souldespoiler', 'The Souldespoiler', 'Archfoe'),
  ('the-source-of-corruption', 'The Source Of Corruption', 'Archfoe'),
  ('the-time-guardian', 'The Time Guardian', 'Archfoe'),
  ('the-unarmored-voidborn', 'The Unarmored Voidborn', 'Archfoe'),
  ('the-unwelcome', 'The Unwelcome', 'Archfoe'),
  ('the-voice-of-ruin', 'The Voice of Ruin', 'Nemesis'),
  ('the-welter', 'The Welter', 'Nemesis'),
  ('the-winter-bloom', 'The Winter Bloom', 'Archfoe'),
  ('tropical-desolator', 'Tropical Desolator', 'Archfoe'),
  ('twisterror', 'Twisterror', 'Bane'),
  ('tyrn', 'Tyrn', 'Nemesis'),
  ('tzumrah-the-dazzler', 'Tzumrah the Dazzler', 'Nemesis'),
  ('unaz-the-mean', 'Unaz the Mean', 'Archfoe'),
  ('urmahlullu-the-weakened', 'Urmahlullu the Weakened', 'Archfoe'),
  ('ushuriel', 'Ushuriel', 'Bane'),
  ('utua-stone-sting', 'Utua Stone Sting', 'Archfoe'),
  ('vashresamun', 'Vashresamun', 'Bane')
) AS v(slug, name, "officialCategory")
WHERE NOT EXISTS (SELECT 1 FROM "BosstiaryBoss" b WHERE b.slug = v.slug);

INSERT INTO "BosstiaryBoss" ("id", "slug", "name", "officialCategory", "accessStatus", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.slug, v.name, v."officialCategory", 'UNKNOWN'::"BosstiaryAccessStatus", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('vemiath', 'Vemiath', 'Archfoe'),
  ('vladrukh', 'Vladrukh', 'Archfoe'),
  ('vok-the-freakish', 'Vok the Freakish', 'Archfoe'),
  ('warlord-ruzad', 'Warlord Ruzad', 'Nemesis'),
  ('white-pale', 'White Pale', 'Nemesis'),
  ('willi-wasp', 'Willi Wasp', 'Nemesis'),
  ('world-devourer', 'World Devourer', 'Nemesis'),
  ('wrathful-archivist', 'Wrathful Archivist', 'Archfoe'),
  ('xogixath', 'Xogixath', 'Bane'),
  ('yaga-the-crone', 'Yaga the Crone', 'Nemesis'),
  ('yakchal', 'Yakchal', 'Nemesis'),
  ('yirkas-blue-scales', 'Yirkas Blue Scales', 'Archfoe'),
  ('zamulosh', 'Zamulosh', 'Archfoe'),
  ('zarabustor', 'Zarabustor', 'Nemesis'),
  ('zevelon-duskbringer', 'Zevelon Duskbringer', 'Nemesis'),
  ('zomba', 'Zomba', 'Nemesis'),
  ('zorvorax', 'Zorvorax', 'Archfoe'),
  ('zugurosh', 'Zugurosh', 'Bane'),
  ('zulazza-the-corruptor', 'Zulazza the Corruptor', 'Nemesis'),
  ('zushuka', 'Zushuka', 'Nemesis')
) AS v(slug, name, "officialCategory")
WHERE NOT EXISTS (SELECT 1 FROM "BosstiaryBoss" b WHERE b.slug = v.slug);

COMMIT;
