# Deployment

This project is intended to deploy as:

- Frontend on Vercel
- Backend on Render

## 1. Deploy Backend on Render

1. Open Render and create a new Blueprint from the GitHub repo.
2. Render will read `render.yaml` and create `dashboard-web-backend`.
3. Use the free plan for the demo.
4. Add required environment variables:

```text
GEMINI_API_KEY=your Gemini key
JWT_SECRET_KEY=a long random private string
ADMIN_EMAIL=your admin email
ADMIN_PASSWORD=your admin password
ADMIN_FULL_NAME=Dashboard Admin
```

Optional variables for extra features:

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-render-backend-url.onrender.com/api/auth/google/callback
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
EMAIL_FROM=...
```

After Render deploys, copy the backend URL. It will look like:

```text
https://dashboard-web-backend.onrender.com
```

Check:

```text
https://dashboard-web-backend.onrender.com/api/health
```

## 2. Deploy Frontend on Vercel

1. Import the GitHub repo into Vercel.
2. Use the Vite defaults:
   - Build command: `npm run build`
   - Output directory: `dist`
3. Add this Vercel environment variable if your Render backend URL is not
   `https://dashboard-web-backend.onrender.com`:

```text
VITE_API_BASE_URL=https://your-render-backend-url.onrender.com
```

If this value is missing, production builds default to:

```text
https://dashboard-web-backend.onrender.com
```

Deploy the frontend and copy the Vercel URL.

## 3. Connect Backend to Frontend

After Vercel gives a URL, update these Render environment variables:

```text
FRONTEND_URL=https://your-vercel-url.vercel.app
CORS_ALLOW_ORIGINS=https://your-vercel-url.vercel.app
```

Then redeploy the backend on Render.

## Demo Notes

Render free services may sleep after inactivity. The first request after sleep can be slow.

The current demo backend stores user accounts in SQLite and dashboard edits in `src/data.json`. On free hosted infrastructure, these are suitable for a demo but should be moved to persistent storage before production use.
