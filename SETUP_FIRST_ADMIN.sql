-- First Super Admin Setup Script
-- Run this script in Supabase SQL Editor after creating your first user via the Supabase Dashboard

-- Step 1: First, create a user in Supabase Dashboard > Authentication > Users
--         with your desired email and password

-- Step 2: Find the user ID from auth.users table
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- Step 3: Update the user's role to super_admin (replace the ID below)
-- Option A: If the user already exists in app_users table
UPDATE app_users
SET role = 'super_admin'
WHERE email = 'YOUR_EMAIL@example.com';

-- Option B: If the user doesn't exist in app_users table yet
-- Replace 'USER_ID_HERE' with the actual UUID from step 2
INSERT INTO app_users (id, email, full_name, role, is_active)
VALUES (
  'USER_ID_HERE',          -- Replace with actual user ID
  'YOUR_EMAIL@example.com', -- Replace with your email
  'Super Admin',            -- Your full name
  'super_admin',
  true
)
ON CONFLICT (id) DO UPDATE
SET role = 'super_admin';

-- Verify the super admin was created
SELECT id, email, full_name, role, is_active FROM app_users WHERE role = 'super_admin';
