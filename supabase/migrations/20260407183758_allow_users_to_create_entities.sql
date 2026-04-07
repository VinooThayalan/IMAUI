/*
  # Allow Non-Admin Users to Create Entities

  Currently only admins can insert into entities and user_entity_access.
  This migration adds policies so any authenticated user can:
  1. Create a new entity
  2. Grant themselves access to that entity (their own user_id only)

  ## Changes
  - New INSERT policy on `entities` for authenticated users
  - New INSERT policy on `user_entity_access` restricted to inserting own user_id
*/

CREATE POLICY "Authenticated users can create entities"
  ON entities
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can grant themselves entity access"
  ON user_entity_access
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
