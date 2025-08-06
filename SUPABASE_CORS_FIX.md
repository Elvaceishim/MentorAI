# Supabase CORS Configuration

## Issue
You're getting a CORS error because Supabase doesn't allow requests from `http://localhost:5173` by default.

## Solution: Configure Supabase Authentication Settings

1. **Go to your Supabase Dashboard**:
   - Visit https://supabase.com/dashboard
   - Select your project: `fedtvhvveazagunronvb`

2. **Navigate to Authentication Settings**:
   - Click on "Authentication" in the left sidebar
   - Click on "Settings" tab

3. **Add localhost to Site URL**:
   - Find "Site URL" field
   - Set it to: `http://localhost:5173`

4. **Add localhost to Additional Redirect URLs**:
   - Find "Additional Redirect URLs" field
   - Add these URLs (one per line):
     ```
     http://localhost:5173
     http://localhost:5173/**
     http://localhost:8888
     http://localhost:8888/**
     ```

5. **Save the changes**

## Alternative Quick Fix (If above doesn't work immediately)

If you're still getting CORS errors after the above, try these additional settings:

1. **In Authentication Settings**, also add to "Additional Redirect URLs":
   ```
   http://localhost:3000
   http://localhost:3000/**
   http://127.0.0.1:5173
   http://127.0.0.1:5173/**
   ```

2. **CORS Origins** (if available in settings):
   ```
   http://localhost:5173
   http://localhost:8888
   http://127.0.0.1:5173
   ```

## After Configuration

1. Wait 1-2 minutes for changes to propagate
2. Refresh your browser at `http://localhost:5173`
3. Try signing in again

## Test Your Configuration

After making these changes, your magic link authentication should work without CORS errors.

## Note
The environment variables have been updated in your `.env` file to include the `VITE_` prefixed versions that your frontend needs.
