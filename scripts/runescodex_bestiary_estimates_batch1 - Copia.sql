-- RuneCodex: estimativas iniciais de kills/h do Bestiário
-- Somente UPDATE em BestiaryEntry já existente; não cria criaturas nem BestiaryEntry.
-- Revise as estimativas antes de executar em produção.
BEGIN;
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 125 WHERE "creatureId" = 'c3000001-0001-4000-8000-000000000004'; -- Hellhound: ~20h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 312 WHERE "creatureId" = 'c3000001-0001-4000-8000-000000000007'; -- Dawnfire Asura: ~8h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 250 WHERE "creatureId" = 'c3000001-0001-4000-8000-000000000008'; -- Hellspawn: ~4h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 167 WHERE "creatureId" = 'c3000001-0001-4000-8000-000000000011'; -- Sphinx: ~15h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 50 WHERE "creatureId" = 'c3000001-0001-4000-8000-000000000015'; -- Scorpion: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 208 WHERE "creatureId" = 'e5925d45-61e2-4fa0-a090-23de1c98efda'; -- Mean Lost Soul: ~12h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 250 WHERE "creatureId" = '8ec30dbb-138a-41ea-ae49-9c3143f19072'; -- Crazed Winter Rearguard: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 167 WHERE "creatureId" = '664719db-4875-498e-bf4c-33dde1257ca9'; -- Arachnophobica: ~15h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = '35d2ffd2-e4f9-4441-9ab1-35d5181c9f12'; -- Plaguesmith: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 125 WHERE "creatureId" = 'ef268ed6-d1e1-43b2-8ebe-4652da3e9f5e'; -- Blightwalker: ~20h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 50 WHERE "creatureId" = '369f5384-9465-4d6f-81da-8f4960c47e99'; -- Juggernaut: ~50h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 67 WHERE "creatureId" = 'c989bf4d-00fa-4b5d-810f-b55bc3edd4f4'; -- Lich: ~15h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 167 WHERE "creatureId" = '9e0672c3-59e7-4bc0-80ed-8020492ad3c0'; -- Lizard Chosen: ~6h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 83 WHERE "creatureId" = '171f4ae9-eebe-4aaa-ae2f-1904839a86bf'; -- Dragon Lord: ~12h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 200 WHERE "creatureId" = '3d572b10-e29e-4945-82b3-99ab7e161256'; -- Wyrm: ~5h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 67 WHERE "creatureId" = 'e073530d-735f-4aa8-92ac-2b0d61148ac9'; -- Souleater: ~15h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 83 WHERE "creatureId" = 'd7903b44-e153-4d2e-993e-0cd3dc91b684'; -- Brimstone Bug: ~12h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 67 WHERE "creatureId" = 'fd040639-2ab1-421a-8ad9-fc16f00d404c'; -- Dragon Lord Hatchling: ~15h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 56 WHERE "creatureId" = '687622ef-6fe4-4108-a617-90e177433081'; -- Wailing Widow: ~18h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 83 WHERE "creatureId" = 'cbac1a61-3129-4289-a113-9fb4e603060a'; -- Centipede: ~6h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 167 WHERE "creatureId" = '0dff2874-937c-455c-a91f-c6dcaa6817cf'; -- Crazed Summer Vanguard: ~15h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 200 WHERE "creatureId" = '0a2b8d55-a17e-4a1a-9aff-f933d09c5977'; -- Ravenous Lava Lurker: ~5h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = 'a9ea0beb-2db5-4afe-9e57-bec54d52e178'; -- Drillworm: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 40 WHERE "creatureId" = 'fb991d2e-81f7-42c7-ad8b-736354b79838'; -- Devourer: ~25h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = '6ae4691d-1a35-47a8-8f56-011680c2868a'; -- Worker Golem: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 83 WHERE "creatureId" = '2a781794-947f-448e-ba19-8e5be0c304e8'; -- Rustheap Golem: ~12h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = '7f2fdba7-7cab-4dac-9490-a27af73ff8be'; -- Glooth Golem: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = '8c7a7e08-9c1d-4dac-b634-dcc7ce83f67d'; -- Cult Believer: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = 'acad6e12-8c3c-4f34-8ec0-cf4b384df98b'; -- Vile Grandmaster: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = '44a4c997-57d3-4332-9a70-60e4fb2ad811'; -- Cult Enforcer: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 192 WHERE "creatureId" = '1cc40cd7-8d61-4c3c-bf45-f97a55cf083e'; -- Dark Carnisylvan: ~13h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 83 WHERE "creatureId" = '004f7955-ab5b-42e2-bec2-1857e003ad79'; -- Rot Elemental: ~12h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 125 WHERE "creatureId" = 'e8dd70ac-53e6-4d5a-8b6f-f8053668e3aa'; -- Hellfire Fighter: ~20h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 156 WHERE "creatureId" = '1bb42847-66ea-4070-9750-e1e1f9e6dbfc'; -- Lost Berserker: ~16h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 67 WHERE "creatureId" = '4342369f-a10f-4d53-b113-d9e92c6f0abf'; -- Demon Skeleton: ~15h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 83 WHERE "creatureId" = 'eb9c559e-9aef-4639-8264-2f6dd13c55c9'; -- Crypt Shambler: ~6h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = '7bbf9ca3-ae04-4a37-804f-0d017e002b53'; -- Pirat Mate: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 500 WHERE "creatureId" = '2969af84-f941-4bd7-a753-4522bdbabb18'; -- Tarantula: ~1h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 62 WHERE "creatureId" = '27219bcb-3bac-4d2a-a7ab-89bc7b31af0b'; -- Ghoul: ~8h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = 'edbc0c9b-f7a6-419e-87f4-5feef5628b25'; -- Earth Elemental: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 125 WHERE "creatureId" = '0ac1fd41-0c74-4377-b7f6-310f9a780578'; -- Exotic Cave Spider: ~8h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 167 WHERE "creatureId" = 'c4b783f3-db79-4530-b343-8c9e9667e6d1'; -- Exotic Bat: ~6h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 125 WHERE "creatureId" = 'a0bd42fc-05e2-40d6-89b7-dc5c4fe58bc1'; -- Yielothax: ~8h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 62 WHERE "creatureId" = 'c551beb9-004c-45fc-8add-b1277bbc1723'; -- Elf Scout: ~8h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 62 WHERE "creatureId" = 'b77841e0-8c23-4911-ae87-81a287b12806'; -- Minotaur Mage: ~8h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = '42fd3b6a-8ed1-4b0c-aa90-ad1985ecf6a4'; -- Minotaur Guard: ~5h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 500 WHERE "creatureId" = '17aa766f-500e-4fb7-8530-1bcbff0f5e45'; -- Cyclops Drone: ~2h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 50 WHERE "creatureId" = '0061646b-cb10-4f22-8a5f-ba3e278dfc60'; -- Elf Arcanist: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 500 WHERE "creatureId" = 'cde3d3a7-5ccc-4577-8fbc-5a4c5d8a168d'; -- Cyclops: ~1h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 333 WHERE "creatureId" = '08ac0457-0774-445c-b0d1-20a11727e5e3'; -- Cyclops Smith: ~3h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 125 WHERE "creatureId" = '59622108-caf5-4d20-920d-0a4bcba82002'; -- Minotaur Archer: ~4h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 125 WHERE "creatureId" = '08adc506-1df5-4110-8d19-19d26bc25f5d'; -- Hero: ~8h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = '6d2ad163-991f-44cd-969f-b93e1fcba41f'; -- Wyvern: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = '7f40f56b-14df-4113-b4ed-2335c28735b5'; -- Ancient Scarab: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = '3e8e17ed-8fbf-4624-b9d6-02bf06728128'; -- Feversleep: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 62 WHERE "creatureId" = 'bb05c3e9-8a32-47cf-94f6-94c4a298cb43'; -- Stone Golem: ~8h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 156 WHERE "creatureId" = '08148764-1d7b-405b-8de2-033633aaf884'; -- Terrorsleep: ~16h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 25 WHERE "creatureId" = '84438d54-6ce2-4a6b-9dba-21bf676ded9c'; -- Mummy: ~20h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 125 WHERE "creatureId" = '056bcad3-b417-4010-91a5-d1cc504e3bc5'; -- Crawler: ~8h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 83 WHERE "creatureId" = '68bf6ee4-05be-4a9a-b7ce-0ab8bf42d38d'; -- Hive Overseer: ~30h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 50 WHERE "creatureId" = '203ec183-a344-4212-b756-ffacfdd3e741'; -- Kollos: ~20h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 67 WHERE "creatureId" = 'fabb090e-c196-4bde-bbd7-8caf4362e59f'; -- Waspoid: ~15h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = 'd7ba4931-c6fe-4caf-8770-d95ceb6d25eb'; -- Spitter: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = 'c94ec874-8a9f-4eab-8311-f95be1c94f40'; -- Werebadger: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = '32082e7f-4179-48c6-9db0-bb6b0b64f2fc'; -- Werebear: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 50 WHERE "creatureId" = '935c12c9-b087-4c22-8d05-6fe99d3e512d'; -- Spidris: ~20h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 40 WHERE "creatureId" = '1a367ceb-9033-43ca-8e9c-5d5fea07f134'; -- Spidris Elite: ~25h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = '0c59a8c2-c12f-4107-a77e-5c57e787d08f'; -- Young Sea Serpent: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = '7287aaf6-fed3-492a-8b1e-a9405ebc5bd9'; -- Roaring Lion: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 333 WHERE "creatureId" = '36643ba6-2275-4d98-ad4e-be8213fc75a6'; -- Mutated Human: ~3h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 100 WHERE "creatureId" = '74d6aae3-0a46-4ac6-bdc5-80ae18c53835'; -- Sea Serpent: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 17 WHERE "creatureId" = 'df8a33df-22bc-4d2b-8165-c36a116a1e29'; -- Spit Nettle: ~30h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 167 WHERE "creatureId" = '82ce7e96-e8c6-4355-8bd0-2784e4f35735'; -- Vampire: ~6h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 33 WHERE "creatureId" = 'd7ac40d4-9ad8-4e7d-ad58-190002bb96ec'; -- Deepsea Blood Crab: ~15h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 125 WHERE "creatureId" = 'df9edeee-4c40-416a-aa7a-a98ec2835cea'; -- Choking Fear: ~20h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 250 WHERE "creatureId" = '7967ca79-a249-4b80-aa80-c9e5dc71459d'; -- Guzzlemaw: ~10h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 167 WHERE "creatureId" = '9df894ec-7657-40dd-93d2-639d98f158ae'; -- Carrion Worm: ~3h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 167 WHERE "creatureId" = 'ae8331fc-17c9-44a3-9c36-9778d543a5aa'; -- Minotaur: ~3h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 125 WHERE "creatureId" = '26006434-0a02-46f1-b77b-0dedb0ea0074'; -- Elf: ~4h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 62 WHERE "creatureId" = '448d4762-9005-4514-beaa-383fbf3a6244'; -- Rotworm: ~8h via TibiaRoute
UPDATE "BestiaryEntry" SET "estimatedKillsPerHour" = 125 WHERE "creatureId" = '34de8542-1e91-4be5-915e-4d8637b462f0'; -- Poison Spider: ~2h via TibiaRoute
COMMIT;
