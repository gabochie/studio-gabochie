# GideonAbochie Studio

Full-stack platform for the School of Creativity, Love & Wisdom — education,
payments, email automation, digital products, content management,
subscriptions, student tracking, certificates, and gamified learning.

**Domain**: https://gideonabochie.org

## Deploy

This project requires **Cloudflare Pages with Functions + D1 database**.
See [DEPLOY.md](DEPLOY.md) for full setup instructions.

## Development

```bash
npm install    # Install dependencies + install pre-commit hook
npm run dev    # Start local server (requires Cloudflare Pages Functions emulator)
npm test       # Run unit + API tests
npm run check  # Run lint + tests
```

## Project Structure

```
├── functions/         Cloudflare Pages Functions (API endpoints)
│   ├── api/           Public API routes
│   └── admin/        Admin-only API routes
├── tests/             Test suite
│   ├── unit/          Unit tests (vitest)
│   ├── api/           API integration tests (vitest)
│   └── e2e/           E2E tests (Playwright)
├── admin/             Admin dashboard pages
├── books/             Digital books pages
├── school/            School/courses pages
├── support/           Donation/support pages
├── .github/           CI/CD workflows
└── scripts/           Build/utility scripts
```

Built for Gideon Abochie.
