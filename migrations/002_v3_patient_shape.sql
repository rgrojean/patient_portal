-- PIS v3: ssn removed from API; drop legacy NOT NULL column from cache
ALTER TABLE portal_patients DROP COLUMN IF EXISTS ssn;
