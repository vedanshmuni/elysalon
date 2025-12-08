# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of SalonOS seriously. If you discover a security vulnerability, please follow these steps:

### 1. Do Not Publicly Disclose

Please do not create a public GitHub issue for security vulnerabilities. This protects users while the issue is being resolved.

### 2. Report Privately

Send details to: **security@yourcompany.com** (or create a private security advisory on GitHub)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### 3. Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 1-7 days
  - High: 7-14 days
  - Medium: 14-30 days
  - Low: 30+ days

## Security Best Practices

### For Developers

1. **Environment Variables**:
   - Never commit `.env.local` to version control
   - Use strong, unique Supabase keys
   - Rotate keys periodically

2. **Database Security**:
   - Always use RLS policies
   - Never bypass RLS in application code
   - Validate all user input
   - Use parameterized queries (Supabase client handles this)

3. **Authentication**:
   - Enforce strong password requirements
   - Use Supabase Auth (handles JWT securely)
   - Implement rate limiting for auth endpoints
   - Enable MFA for production (Supabase Pro feature)

4. **API Security**:
   - Validate all inputs with Zod schemas
   - Check user permissions before operations
   - Use HTTPS only in production
   - Implement CORS properly

5. **Dependencies**:
   - Keep dependencies up to date
   - Run `npm audit` regularly
   - Review security advisories

### For Deployment

1. **Supabase**:
   - Use Supabase Pro for production
   - Enable database backups
   - Set up monitoring and alerts
   - Use connection pooling

2. **Hosting (Render/Vercel)**:
   - Use environment variables for secrets
   - Enable HTTPS (automatic on Render)
   - Set up DDoS protection
   - Configure firewall rules

3. **Monitoring**:
   - Set up error tracking (Sentry)
   - Monitor database queries
   - Log suspicious activity
   - Set up uptime monitoring

## Known Security Considerations

### Row Level Security (RLS)
- All tenant data is protected by RLS policies
- Policies enforce `tenant_id` scoping automatically
- Users can only access their own tenant's data

### Authentication
- JWT tokens stored in HTTP-only cookies
- Automatic token refresh via middleware
- Session management by Supabase Auth

### Input Validation
- Client-side validation with Zod schemas
- Server-side validation required for all mutations
- Type safety with TypeScript

### CSRF Protection
- Built into Next.js Server Actions
- SameSite cookie policy enforced

### XSS Protection
- React escapes output by default
- No `dangerouslySetInnerHTML` used
- Content Security Policy recommended

## Security Checklist for Production

- [ ] Environment variables secured
- [ ] HTTPS enforced
- [ ] RLS policies enabled and tested
- [ ] Strong password policy configured
- [ ] Rate limiting implemented
- [ ] Database backups enabled
- [ ] Monitoring and alerts set up
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] Error messages don't leak sensitive data
- [ ] Dependency vulnerabilities fixed
- [ ] Security audit performed

## Vulnerability Disclosure

When a vulnerability is fixed:

1. Security advisory published
2. CVE requested if applicable
3. Users notified via:
   - GitHub security advisory
   - Release notes
   - Email (if critical)

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/security)

## Questions?

For security-related questions (non-vulnerabilities), open a GitHub discussion or contact the maintainers.
