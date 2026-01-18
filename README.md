# Cemetery Locator - Public App

Public-facing cemetery grave locator application with GPS navigation.

## Features

- Ì¥ç Search deceased persons by name
- Ì∑∫Ô∏è Interactive cemetery maps
- Ì≥ç Real-time GPS tracking
- Ì∑≠ Turn-by-turn navigation (walking, driving, cycling)
- Ì≥± Mobile-first responsive design

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env.local`:
```
POSTGRES_URL=your_neon_database_url
NEXT_PUBLIC_OPENROUTESERVICE_API_KEY=your_api_key
```

3. Run development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Database

Shares the same Neon PostgreSQL database with the admin app.

## Deployment

Deploy to Vercel:
```bash
vercel
```

Add environment variables in Vercel dashboard:
- `POSTGRES_URL`
- `NEXT_PUBLIC_OPENROUTESERVICE_API_KEY`

## Architecture

- **Admin App** (pafm-c): Cemetery management, plot creation, deceased records
- **Public App** (pafm-locator): Read-only grave locator with GPS navigation

Both apps connect to the same database but serve different purposes.
