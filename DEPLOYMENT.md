# Deployment

This project is intended to deploy as:

- Frontend on Vercel
- Backend on Render

## 1. Deploy Backend on Render

1. Open Render and create a new Blueprint from the GitHub repo.
2. Render will read `render.yaml` and create `dashboard-web-backend`.
3. Use the free plan for the demo.
4. Confirm the backend has a persistent disk mounted at:

```text
/app/backend/data
```

SQLite users are stored at:

```text
/app/backend/data/users.db
```

5. Add required environment variables:

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
```

Email settings for Gmail SMTP:

```text
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USE_SSL=true
SMTP_USERNAME=lamis.fa09@gmail.com
SMTP_PASSWORD=your Gmail App Password
EMAIL_FROM=lamis.fa09@gmail.com
```

For password reset emails on Render, add these in Environment > Environment
Variables if you want to send through Gmail:

```text
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USE_SSL=true
SMTP_USERNAME=lamis.fa09@gmail.com
SMTP_PASSWORD=your-16-character-gmail-app-password
EMAIL_FROM=lamis.fa09@gmail.com
```

Use a Gmail App Password for `SMTP_PASSWORD`; your normal Gmail password will
not work. In Google Account settings, enable 2-Step Verification, then create an
App Password for this backend.

If you later use Resend instead, add:

```text
RESEND_API_KEY=re_...
EMAIL_FROM=PROJEX <noreply@your-verified-domain.com>
```

For production sending to arbitrary recipients, verify your own domain in
Resend and use that domain in `EMAIL_FROM`. `onboarding@resend.dev` is a
Resend testing sender and can be rejected for normal app users with eligibility
or sender-domain errors. Resend uses HTTPS, so it avoids the SMTP timeout
problem on Render.

After Render deploys, copy the backend URL. It will look like:

```text
https://dashboard-web-backend.onrender.com
```

Check:

```text
https://dashboard-web-backend.onrender.com/api/health
```

The health response should include:

```json
{
  "email_configured": true,
  "email": {
    "configured": true,
    "provider": "smtp",
    "smtp_host_present": true,
    "smtp_port": 465,
    "smtp_username_present": true,
    "smtp_password_present": true,
    "smtp_use_ssl": true,
    "resend_api_key_present": false,
    "email_from_present": true,
    "uses_resend_testing_sender": false
  },
  "database": {
    "path": "/app/backend/data/users.db",
    "is_persistent_path": true,
    "disk_mounted": true
  }
}
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
