-- PIS v3: drop cache column with no successor (existing DBs; no-op on fresh 001)
ALTER TABLE portal_patients DROP COLUMN IF EXISTS ssn;
