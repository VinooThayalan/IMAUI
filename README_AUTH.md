# Authentication & Authorization Setup

This application now includes a comprehensive role-based access control system.

## Roles

1. **Super Admin**
   - Full access to all features and entities
   - Can manage users and their permissions
   - Can assign entity and menu access to other users

2. **Admin**
   - Access to all menus/features
   - Limited to specific entities assigned by Super Admin
   - Cannot manage users

3. **Manager**
   - Limited access to specific menus assigned by Super Admin
   - Limited to specific entities assigned by Super Admin
   - Cannot manage users

## Initial Setup

### Creating the First Super Admin User

Since you need a Super Admin to create other users, you'll need to create the first Super Admin manually using Supabase:

1. Go to your Supabase Dashboard → Authentication → Users
2. Click "Add user" and create a user with email and password
3. After creating the user, go to SQL Editor and run:

```sql
INSERT INTO app_users (id, email, full_name, role, is_active)
VALUES (
  'USER_ID_FROM_AUTH_USERS',  -- Replace with the actual user ID from auth.users
  'admin@example.com',         -- Replace with the email
  'Super Admin',               -- Full name
  'super_admin',               -- Role
  true                         -- Active status
);
```

Alternatively, you can update an existing user to be a super admin:

```sql
UPDATE app_users
SET role = 'super_admin'
WHERE email = 'your-email@example.com';
```

## Features

- **User Management**: Super Admin can create, activate/deactivate, and delete users
- **Entity Access Control**: Control which entities (clients) each user can access
- **Menu Access Control**: For managers, control which features/pages they can access
- **Automatic Role Detection**: The system automatically shows/hides features based on permissions
- **Secure Login**: Email/password authentication with Supabase Auth

## Usage

1. **Login**: Users login with their email and password
2. **Navigation**: Only accessible menus are shown in the sidebar
3. **Entity Filtering**: Users only see entities they have access to
4. **Permission Management**: Super Admin can assign permissions via the User Management page

## Security

- Row Level Security (RLS) is enabled on all tables
- Users can only access data they have permission for
- Super Admin actions are restricted at the database level
- All permissions are validated both frontend and backend
