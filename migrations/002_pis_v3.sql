-- Align existing portal_patients rows with PIS v3 cache shape.
-- Idempotent: no-op when 001 already created family/given and omitted ssn/name.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'portal_patients' AND column_name = 'name'
  ) THEN
    ALTER TABLE portal_patients ADD COLUMN IF NOT EXISTS family TEXT;
    ALTER TABLE portal_patients ADD COLUMN IF NOT EXISTS given TEXT[];

    UPDATE portal_patients
    SET
      family = split_part(name, ', ', 1),
      given = CASE
        WHEN name LIKE '%, %' THEN string_to_array(btrim(substring(name FROM position(', ' IN name) + 2)), ' ')
        WHEN name IS NOT NULL AND name <> '' THEN ARRAY[name]
        ELSE ARRAY[]::TEXT[]
      END
    WHERE family IS NULL OR given IS NULL;

    ALTER TABLE portal_patients DROP COLUMN name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'portal_patients' AND column_name = 'ssn'
  ) THEN
    ALTER TABLE portal_patients DROP COLUMN ssn;
  END IF;
END $$;
