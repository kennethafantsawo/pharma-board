-- Run this script in your Supabase SQL Editor to create the necessary tables

-- 1. Create Entities Table
CREATE TABLE IF NOT EXISTS entities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  email TEXT,
  "bankInfo" TEXT,
  "contactPerson" TEXT,
  code TEXT,
  status TEXT DEFAULT 'ACTIF'
);

-- 2. Create Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT,
  description TEXT,
  "entityId" UUID REFERENCES entities(id) ON DELETE SET NULL,
  status TEXT,
  reason TEXT,
  dossiers INTEGER,
  beneficiaires INTEGER
);

-- 3. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  action TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  details TEXT,
  "previousData" JSONB,
  "newData" JSONB
);

-- Disable Row Level Security (RLS) for testing, or create policies
ALTER TABLE entities DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
