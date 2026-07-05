# Authentication Setup

This application uses Supabase authentication with a simple email/password login system.

## Initial Setup

### Creating Users

Users can be created through the Supabase Dashboard:

1. Go to your Supabase Dashboard → Authentication → Users
2. Click "Add user" and create a user with email and password
3. The user will automatically be added to the `app_users` table via a database trigger

### Manual User Creation

If you need to manually confirm a user's email, run this SQL in Supabase:

```sql
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'user@example.com';
```

## Features

- **Secure Login**: Email/password authentication with Supabase Auth
- **User Management**: View all registered users in the system
- **Automatic User Profile**: User profiles are automatically created when users sign up

## Usage

1. **Login**: Users login with their email and password
2. **Full Access**: All authenticated users have full access to the application
3. **User List**: View all registered users via the User Management page

## Security

- Row Level Security (RLS) is enabled on the `app_users` table
- Users can view their own profile and update their own information
- All data access is restricted to authenticated users
