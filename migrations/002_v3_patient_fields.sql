-- PIS v3: ssn removed from API payloads; relax NOT NULL so sync can omit the field.
ALTER TABLE portal_patients ALTER COLUMN ssn DROP NOT NULL;
