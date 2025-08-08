# MentorAI Database Setup Instructions

## Step 1: Access Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your MentorAI project: `fedtvhvveazagunronvb`

## Step 2: Run the Database Setup
1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy the entire contents of `complete_database_setup.sql` 
4. Paste it into the SQL editor
5. Click **Run** to execute the script

## Step 3: Verify the Setup
After running the script, check that these tables exist in **Table Editor**:
- ✅ `messages` (should now have `room_id`, `edited_at`, `file_url`, etc.)
- ✅ `chat_rooms` 
- ✅ `message_reactions`
- ✅ `user_profiles`

## Step 4: Check Storage
In **Storage** section, verify:
- ✅ `message-files` bucket exists and is public

## Step 5: Test the App
After setup, your app should work without the database errors:
- ✅ Room creation should work
- ✅ Messages should persist with room support
- ✅ Emoji reactions should save
- ✅ File uploads should work
- ✅ User profiles should save

## Troubleshooting
If you get permission errors, make sure:
- Row Level Security policies are properly set
- Your user has the correct permissions
- The `auth.jwt() ->> 'email'` references work with your auth setup

## What This Setup Includes
- 🏠 Multiple chat rooms/channels
- 😄 Emoji reactions on messages  
- 📝 Message editing with timestamps
- 📎 File/image sharing with storage
- 👤 User profiles with avatars and bios
- 🔄 Real-time updates for all features
- 🔒 Proper security policies
- ⚡ Performance indexes

Once you run this setup, all the advanced features should work perfectly!
