-- AlterEnum
-- EM may already exist on production. PostgreSQL 15+ does not error in that case.
ALTER TYPE "Vocation" ADD VALUE IF NOT EXISTS 'EM';
