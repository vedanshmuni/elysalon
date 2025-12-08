# SalonOS Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites Check
- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm or yarn installed
- [ ] Git installed
- [ ] Code editor (VS Code recommended)

### Step 1: Clone and Install (2 minutes)

\`\`\`bash
# Clone the repository
git clone <your-repo-url>
cd salon

# Install dependencies
npm install
\`\`\`

### Step 2: Set Up Supabase (2 minutes)

1. **Go to https://supabase.com and sign up**

2. **Create a new project**:
   - Project name: `salon-os` (or your choice)
   - Database password: (save this securely)
   - Region: Choose closest to you
   - Wait ~2 minutes for provisioning

3. **Get your credentials**:
   - Go to **Settings → API**
   - Copy **Project URL** → This is `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon public key** → This is `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. **Apply database schema**:
   - Go to **SQL Editor** in Supabase Dashboard
   - Click **New Query**
   - Copy entire contents of `supabase/migrations/001_initial_schema.sql`
   - Paste and click **Run**
   - Wait for success message
   - Click **New Query** again
   - Copy entire contents of `supabase/migrations/002_rls_policies.sql`
   - Paste and click **Run**

### Step 3: Configure Environment (30 seconds)

\`\`\`bash
# Copy the example env file
copy .env.example .env.local

# Open .env.local in your editor and fill in:
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
\`\`\`

### Step 4: Run the App (30 seconds)

\`\`\`bash
npm run dev
\`\`\`

Visit http://localhost:3000 🎉

### Step 5: Create Your Account

1. Click **Sign Up**
2. Enter your email and password
3. Complete the **Onboarding** form:
   - Tenant/Business name
   - Branch name
   - Your name
4. You'll be redirected to the dashboard!

## ✅ Verification Checklist

After completing the setup, verify:

- [ ] Dashboard loads and shows 0 bookings, 0 clients, etc.
- [ ] Sidebar navigation works
- [ ] Can navigate to Clients page
- [ ] Can create a new client
- [ ] Client appears in the list
- [ ] Can sign out and sign in again

## 🐛 Troubleshooting

### "Failed to fetch" error
- Check that Supabase URL and key are correct in `.env.local`
- Restart dev server: `Ctrl+C` then `npm run dev`

### Database errors
- Ensure both migration files were run successfully
- Check Supabase Dashboard → Database → Logs for errors

### Build errors
- Run `npm install` again
- Check Node.js version: `node --version` (should be 18+)
- Clear Next.js cache: Delete `.next` folder and restart

### Auth not working
- Verify Supabase project is active
- Check if email confirmation is required (disable in Supabase Auth settings for dev)

## 📚 Next Steps

Now that your app is running:

1. **Explore the code**:
   - Check `app/dashboard/clients` for the complete module example
   - Review `lib/supabase` for database access patterns
   - Look at `components/ui` for reusable components

2. **Implement missing modules**:
   - Follow the pattern from Clients module
   - Each module has a placeholder page with feature list

3. **Customize**:
   - Update branding in `app/layout.tsx`
   - Modify color scheme in `tailwind.config.ts`
   - Add your logo to `public` folder

4. **Deploy** (when ready):
   - Follow `docs/DEPLOYMENT.md`
   - Push to GitHub
   - Connect to Render
   - Add environment variables
   - Deploy!

## 🎯 Development Commands

\`\`\`bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Run production build
npm run lint         # Run ESLint
npm run type-check   # Check TypeScript types
npm run format       # Format code with Prettier
\`\`\`

## 📖 Documentation

- **README.md** - Project overview and detailed setup
- **docs/ARCHITECTURE.md** - System architecture and patterns
- **docs/API.md** - Database access and API patterns
- **docs/DEPLOYMENT.md** - Production deployment guide
- **CONTRIBUTING.md** - How to contribute

## 💡 Tips

- Use server components for data fetching (no "use client")
- Add "use client" only for interactive components
- Always scope queries by tenant_id
- RLS policies automatically enforce tenant isolation
- Use the Clients module as a reference for new modules

## 🆘 Need Help?

- Check existing issues on GitHub
- Review documentation in `docs/` folder
- Open a new issue with details

## 🎊 You're All Set!

Your SalonOS instance is ready for development. Start building your salon management system!

Happy coding! 🚀
