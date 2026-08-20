-- portal_patients: local cache of PIS demographics (v3 given/family; ssn dropped)
CREATE TABLE IF NOT EXISTS portal_patients (
  patient_id TEXT PRIMARY KEY,
  family TEXT,
  given TEXT[],
  dob TEXT,
  gender TEXT,
  phone TEXT,
  email TEXT,
  addr_line1 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  patient_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- seeded portal accounts (trivial auth stub)
CREATE TABLE IF NOT EXISTS portal_users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  patient_id TEXT
);

INSERT INTO portal_users (username, password, role, patient_id) VALUES
  ('swilliams', 'password', 'patient', '200104'),
  ('admin', 'admin', 'admin', NULL)
ON CONFLICT (username) DO NOTHING;

INSERT INTO portal_patients (patient_id, family, given, dob, gender, phone, email, addr_line1, city, state, zip) VALUES
  ('200104', 'Williams', ARRAY['Sarah'], '09/28/1987', 'F', '931-555-0144', 'swilliams.sam@example.com', '14 Maple Court', 'Clarksville', 'TN', '37040'),
  ('550001', 'Patel', ARRAY['Ravi'], '04/17/1968', 'M', '931-555-0177', 'rpatel@example.com', '402 College St', 'Clarksville', 'TN', '37044'),
  ('550002', 'Ortiz', ARRAY['Diego'], '02/11/1995', 'M', '931-555-0166', 'dortiz@example.com', '88 Providence Blvd', 'Clarksville', 'TN', '37042'),
  ('200105', 'Mitchell', ARRAY['James'], '05/22/1966', 'M', '931-555-0301', 'jmitchell@example.com', '220 Riverside Dr', 'Clarksville', 'TN', '37040'),
  ('200106', 'Turner', ARRAY['Emily'], '08/08/1994', 'F', '931-555-0302', 'eturner@example.com', '15 Madison St', 'Clarksville', 'TN', '37040'),
  ('200107', 'Phillips', ARRAY['Carl'], '11/16/1959', 'M', '931-555-0303', NULL, '780 Wilma Rudolph Blvd', 'Clarksville', 'TN', '37040'),
  ('200108', 'Campbell', ARRAY['Ruth'], '02/02/1981', 'F', '931-555-0304', 'rcampbell@example.com', '41 Peachers Mill Rd', 'Clarksville', 'TN', '37042'),
  ('200109', 'Parker', ARRAY['Thomas'], '06/29/1970', 'M', '931-555-0305', 'tparker@example.com', '310 Kraft St', 'Clarksville', 'TN', '37040'),
  ('200110', 'Evans', ARRAY['Gloria'], '10/10/1948', 'F', '931-555-0306', 'gevans@example.com', '9 Tiny Town Rd', 'Clarksville', 'TN', '37042'),
  ('200111', 'Edwards', ARRAY['Frank'], '03/13/1989', 'M', '931-555-0307', NULL, '505 Fort Campbell Blvd', 'Clarksville', 'TN', '37042')
ON CONFLICT (patient_id) DO NOTHING;

INSERT INTO messages (patient_id, body) VALUES
  ('200104', 'Your lab results are ready. Please call the clinic if you have questions.');
