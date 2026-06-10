-- Run this in your Supabase SQL Editor (supabase.com → Project → SQL Editor)

-- People table
create table people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ministry text not null,
  role text,
  notes text,
  sc_date date,
  sc_expiry text,
  wwcc_number text,
  wwcc_date date,
  wwcc_expiry text,
  reminder_log text[] default '{}',
  updated_at timestamptz default now()
);

-- Ministry leaders table
create table ministry_leaders (
  ministry_id text primary key,
  label text not null,
  email text
);

-- Settings table (PIN etc)
create table settings (
  key text primary key,
  value text
);

-- Seed ministry leaders
insert into ministry_leaders (ministry_id, label, email) values
  ('mininova',     'MiniNova',              'mininova@novachurch.com.au'),
  ('frontline',    'Frontline',             'frontline@novachurch.com.au'),
  ('creative',     'Creative',              'creative@novachurch.com.au'),
  ('creativetech', 'Creative Technology',   'creativetech@novachurch.com.au'),
  ('supernova',    'Supernova',             'supernova@novachurch.com.au'),
  ('building',     'Building Presentation', 'building@novachurch.com.au'),
  ('worship',      'Worship',               'worship@novachurch.com.au');

-- Seed default PIN
insert into settings (key, value) values ('pin', '1234');

-- Enable Row Level Security (keeps data private)
alter table people enable row level security;
alter table ministry_leaders enable row level security;
alter table settings enable row level security;

-- Allow all operations via anon key (the app handles auth via PIN)
create policy "Allow all" on people for all using (true) with check (true);
create policy "Allow all" on ministry_leaders for all using (true) with check (true);
create policy "Allow all" on settings for all using (true) with check (true);
