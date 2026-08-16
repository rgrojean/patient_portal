-- PIS v3: producer no longer supplies ssn; drop unused NOT NULL column (INC-4471)
ALTER TABLE portal_patients DROP COLUMN IF EXISTS ssn;
