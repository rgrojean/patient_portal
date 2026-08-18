-- PIS v3: drop ssn, add given/family name columns (upgrade path from v2 cache schema)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_patients' AND column_name = 'ssn'
  ) THEN
    ALTER TABLE portal_patients ALTER COLUMN ssn DROP NOT NULL;
    ALTER TABLE portal_patients DROP COLUMN ssn;
  END IF;
END $$;
ALTER TABLE portal_patients ADD COLUMN IF NOT EXISTS given TEXT[];
ALTER TABLE portal_patients ADD COLUMN IF NOT EXISTS family TEXT;
