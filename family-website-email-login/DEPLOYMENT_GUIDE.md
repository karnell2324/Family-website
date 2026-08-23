# Deploy without requiring ChatGPT

Family members need only a web browser. Node.js, VS Code, Supabase, and Vercel are only for the developer/owner.

## Part 1: Create the Supabase backend

1. Create a free account at `supabase.com`.
2. Select **New project** and create a project named `family-website`.
3. Open **SQL Editor** in the new project.
4. Copy all of `supabase/schema.sql` into the editor and select **Run**.
5. Open the project's **Connect** screen and copy:
   - Project URL
   - Publishable key

## Part 2: Test locally

1. Copy `.env.example` to `.env.local`.
2. Replace the two placeholders with the Supabase Project URL and publishable key.
3. Run:

```bash
npm install
npm run dev
```

4. Open the local URL shown in the terminal.
5. Create Karnell's account first. The first account automatically becomes the approved administrator.

## Part 3: Put the code on GitHub

1. Create an empty private GitHub repository.
2. Upload this project or push it with Git.
3. Never upload `.env.local`.

## Part 4: Deploy with Vercel

1. Create a free account at `vercel.com`.
2. Select **Add New > Project**.
3. Import the GitHub repository.
4. Add these environment variables before deploying:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
5. Select **Deploy**.

## Part 5: Configure Supabase for the live address

1. Copy the live Vercel address.
2. In Supabase, open **Authentication > URL Configuration**.
3. Set **Site URL** to the live Vercel address.
4. Add the same address to **Redirect URLs**.

## Part 6: Add Bahaiz

1. Send Bahaiz the Vercel website link.
2. He creates an account with his email and password.
3. Karnell signs in and opens **Administration**.
4. Karnell approves Bahaiz and selects **Make admin**.

## Email confirmation note

For initial family testing, you may disable **Confirm email** under the Supabase email authentication provider. If confirmation remains enabled, Supabase's built-in email service is rate-limited. Configure custom SMTP before inviting a larger family group.
