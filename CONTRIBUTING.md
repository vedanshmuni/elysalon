# Contributing to SalonOS

Thank you for considering contributing to SalonOS! This document provides guidelines for contributing to the project.

## Development Setup

1. **Fork and Clone**:
   \`\`\`bash
   git clone https://github.com/yourusername/salon-os.git
   cd salon-os
   \`\`\`

2. **Install Dependencies**:
   \`\`\`bash
   npm install
   \`\`\`

3. **Set Up Environment**:
   - Copy \`.env.example\` to \`.env.local\`
   - Fill in Supabase credentials

4. **Run Development Server**:
   \`\`\`bash
   npm run dev
   \`\`\`

## Code Style

- **TypeScript**: Use strict mode, define types for all props
- **Formatting**: Prettier configured (runs on save)
- **Linting**: ESLint configured
- **Naming**:
  - Components: PascalCase
  - Files: kebab-case
  - Functions: camelCase
  - Constants: UPPER_SNAKE_CASE

## Project Structure

\`\`\`
app/                    # Next.js App Router pages
├── (auth)/            # Auth pages (signin, signup)
├── dashboard/         # Protected dashboard pages
└── api/              # API routes

components/            # React components
├── ui/               # UI primitives (shadcn)
└── layout/           # Layout components

lib/                   # Utility functions
├── supabase/         # Supabase clients
└── utils/            # Helper functions

supabase/             # Database migrations
└── migrations/       # SQL migration files
\`\`\`

## Making Changes

1. **Create Branch**:
   \`\`\`bash
   git checkout -b feature/your-feature-name
   \`\`\`

2. **Make Changes**:
   - Follow existing patterns
   - Keep changes focused and atomic
   - Write clear commit messages

3. **Test Locally**:
   - Run \`npm run type-check\`
   - Run \`npm run lint\`
   - Test in browser

4. **Commit**:
   \`\`\`bash
   git add .
   git commit -m "feat: add feature description"
   \`\`\`

## Commit Message Format

Follow conventional commits:

- \`feat:\` New feature
- \`fix:\` Bug fix
- \`docs:\` Documentation changes
- \`style:\` Code style changes (formatting)
- \`refactor:\` Code refactoring
- \`test:\` Adding tests
- \`chore:\` Maintenance tasks

Examples:
\`\`\`
feat: add booking calendar view
fix: resolve RLS policy issue for staff
docs: update deployment guide
refactor: simplify client form validation
\`\`\`

## Adding New Features

### 1. Database Changes

If your feature requires database changes:

1. Create new migration file:
   \`\`\`
   supabase/migrations/003_your_feature.sql
   \`\`\`

2. Write SQL with:
   - Table creation with indexes
   - RLS policies
   - Helper functions if needed

3. Test migration locally

### 2. New Pages

Follow the established pattern:

\`\`\`typescript
// Server Component (page.tsx)
export default async function FeaturePage() {
  const supabase = await createClient();
  // Fetch data
  return <FeatureList data={data} />;
}

// Client Component (new/page.tsx)
'use client';
export default function NewFeaturePage() {
  // Form handling
  return <FeatureForm />;
}
\`\`\`

### 3. New Components

1. Create in appropriate directory
2. Export from index if needed
3. Use TypeScript for props
4. Follow shadcn/ui patterns

### 4. Documentation

Update relevant docs:
- README.md for major features
- API.md for new API patterns
- ARCHITECTURE.md for architectural changes

## Testing

Currently manual testing. Future additions:
- Unit tests (Jest)
- Integration tests (Playwright)
- E2E tests

Manual testing checklist:
- ✅ Feature works as expected
- ✅ No console errors
- ✅ TypeScript compiles
- ✅ ESLint passes
- ✅ Responsive on mobile
- ✅ RLS policies enforced

## Pull Request Process

1. **Update Your Branch**:
   \`\`\`bash
   git fetch origin
   git rebase origin/main
   \`\`\`

2. **Push Changes**:
   \`\`\`bash
   git push origin feature/your-feature-name
   \`\`\`

3. **Create Pull Request**:
   - Clear title and description
   - Reference related issues
   - Include screenshots for UI changes
   - List testing done

4. **Code Review**:
   - Address feedback
   - Keep discussion professional
   - Make requested changes

5. **Merge**:
   - Squash commits if needed
   - Delete branch after merge

## Areas for Contribution

### High Priority
- Complete remaining modules (Bookings, Calendar, POS, etc.)
- Add unit and integration tests
- Improve mobile responsiveness
- Add more UI components

### Medium Priority
- Add search functionality
- Implement filters and sorting
- Add bulk operations
- Export to Excel/PDF

### Low Priority
- Dark mode theme
- Internationalization (i18n)
- Keyboard shortcuts
- Accessibility improvements

## Questions?

- Open an issue for questions
- Check existing issues first
- Be clear and provide context

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- No harassment or discrimination

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
