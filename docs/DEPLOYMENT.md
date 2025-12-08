# Deployment Guide

## Prerequisites

- Supabase account (free tier works)
- Render account (or Vercel/Netlify)
- Node.js 18+ locally

## Step 1: Set Up Supabase

1. **Create Project**:
   - Go to https://supabase.com
   - Click "New Project"
   - Choose organization, name, region, password
   - Wait for provisioning (~2 minutes)

2. **Apply Database Migrations**:
   - Open SQL Editor in Supabase Dashboard
   - Copy contents of `supabase/migrations/001_initial_schema.sql`
   - Run the SQL
   - Copy contents of `supabase/migrations/002_rls_policies.sql`
   - Run the SQL

3. **Get API Credentials**:
   - Go to Project Settings → API
   - Copy `Project URL` (NEXT_PUBLIC_SUPABASE_URL)
   - Copy `anon public` key (NEXT_PUBLIC_SUPABASE_ANON_KEY)

4. **Configure Auth** (Optional):
   - Go to Authentication → Providers
   - Enable Email provider (enabled by default)
   - Configure email templates if needed
   - Add redirect URLs for production

## Step 2: Deploy to Render

### Option A: Deploy via GitHub (Recommended)

1. **Push to GitHub**:
   \`\`\`bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/salon-os.git
   git push -u origin main
   \`\`\`

2. **Create Render Web Service**:
   - Go to https://render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: salon-os
     - **Branch**: main
     - **Runtime**: Node
     - **Build Command**: \`npm install && npm run build\`
     - **Start Command**: \`npm start\`
     - **Instance Type**: Free (or Starter for production)

3. **Add Environment Variables** in Render:
   - \`NEXT_PUBLIC_SUPABASE_URL\`: Your Supabase URL
   - \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`: Your Supabase anon key
   - \`NODE_ENV\`: production

4. **Deploy**:
   - Click "Create Web Service"
   - Wait for build and deployment (~5 minutes)
   - Visit provided URL (e.g., https://salon-os.onrender.com)

### Option B: Manual Deploy

1. **Build Locally**:
   \`\`\`bash
   npm install
   npm run build
   \`\`\`

2. **Deploy via Render CLI** or **Manual Upload**

## Step 3: Configure Production Settings

1. **Update Supabase Auth URLs**:
   - In Supabase Dashboard → Authentication → URL Configuration
   - Add your production URL: \`https://your-app.onrender.com\`
   - Set redirect URLs

2. **Configure Custom Domain** (Optional):
   - In Render → Settings → Custom Domains
   - Add your domain (e.g., app.yourcompany.com)
   - Update DNS records as instructed

3. **Enable HTTPS**:
   - Automatic with Render
   - Certificate provisioned automatically

## Step 4: Post-Deployment

1. **Create First Tenant**:
   - Visit your deployed site
   - Sign up with email/password
   - Complete onboarding to create tenant

2. **Test Core Flows**:
   - Sign in/out
   - Create client
   - View dashboard
   - Check RLS policies working

3. **Monitor**:
   - Check Render logs for errors
   - Check Supabase Dashboard → Database → Logs
   - Set up monitoring (UptimeRobot, etc.)

## Alternative: Deploy to Vercel

1. **Install Vercel CLI**:
   \`\`\`bash
   npm install -g vercel
   \`\`\`

2. **Deploy**:
   \`\`\`bash
   vercel
   \`\`\`

3. **Add Environment Variables**:
   - In Vercel Dashboard → Project → Settings → Environment Variables
   - Add Supabase credentials

4. **Production Deploy**:
   \`\`\`bash
   vercel --prod
   \`\`\`

## Alternative: Deploy to Netlify

1. **Create \`netlify.toml\`**:
   \`\`\`toml
   [build]
     command = "npm run build"
     publish = ".next"

   [[plugins]]
     package = "@netlify/plugin-nextjs"
   \`\`\`

2. **Connect GitHub Repo** in Netlify Dashboard

3. **Add Environment Variables** in Netlify

4. **Deploy**

## Database Backups

### Supabase Automated Backups
- Free tier: Daily backups retained for 7 days
- Pro tier: Point-in-time recovery

### Manual Backup
\`\`\`bash
# Using Supabase CLI
supabase db dump -f backup.sql

# Or using pg_dump
pg_dump -h db.xxxxx.supabase.co -U postgres -d postgres > backup.sql
\`\`\`

## Monitoring & Logs

### Render Logs
\`\`\`bash
# View live logs
render logs <service-id>
\`\`\`

### Supabase Logs
- Database logs in Dashboard → Database → Logs
- Auth logs in Dashboard → Authentication → Logs

## Performance Optimization

1. **Enable Caching**:
   - React Query automatic caching
   - Consider adding Redis for sessions

2. **CDN**:
   - Automatic via Render/Vercel/Netlify
   - Static assets cached at edge

3. **Database Indexes**:
   - Already created in migrations
   - Monitor slow queries in Supabase

4. **Image Optimization**:
   - Use Next.js Image component
   - Configure CDN for user uploads

## Security Checklist

- ✅ RLS policies enabled
- ✅ HTTPS enforced
- ✅ Environment variables secure
- ✅ CORS configured
- ✅ Rate limiting (add via middleware)
- ✅ Input validation with Zod
- ✅ SQL injection prevention (Supabase client)

## Troubleshooting

### Build Fails
- Check Node.js version (18+)
- Verify all dependencies installed
- Check build logs in Render

### Auth Not Working
- Verify Supabase URL/key correct
- Check redirect URLs configured
- Ensure RLS policies applied

### Database Connection Issues
- Check Supabase project status
- Verify connection pooler settings
- Check database logs

### 500 Errors
- Check server logs in Render
- Verify environment variables set
- Check Supabase logs for errors

## Scaling

### Horizontal Scaling
- Render: Upgrade to multiple instances
- Vercel: Automatic scaling

### Database Scaling
- Supabase: Upgrade plan for more resources
- Consider read replicas for analytics

### Background Jobs
- Use Supabase Edge Functions
- Or integrate with job queue (BullMQ, etc.)

## Cost Estimation

### Free Tier (Development)
- Render: Free (sleeps after inactivity)
- Supabase: Free (500MB database, 50k users)
- **Total**: $0/month

### Production (Small Business)
- Render Starter: $7/month
- Supabase Pro: $25/month
- Custom Domain: $10-15/year
- **Total**: ~$32/month

### Production (Growing Business)
- Render Standard: $85/month
- Supabase Pro: $25/month
- Monitoring: $10/month
- **Total**: ~$120/month

## Rollback Procedure

### Code Rollback
\`\`\`bash
# Render: Redeploy previous version
# Or via Git:
git revert HEAD
git push
\`\`\`

### Database Rollback
\`\`\`bash
# Restore from Supabase backup
# Via Dashboard → Database → Backups → Restore
\`\`\`

## CI/CD

GitHub Actions workflow already configured in `.github/workflows/ci.yml`:
- Runs on push to main
- Lints code
- Type checks
- Builds project

## Health Checks

Create `/api/health/route.ts`:
\`\`\`typescript
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
}
\`\`\`

Configure in Render → Settings → Health Check Path: \`/api/health\`
