## AI Resume Builder

Vite + React + TypeScript resume builder with an AI editor.

This project runs fully client-side (no backend). AI calls are made directly from the browser using the API key the user enters in the app (stored in `localStorage`).

### Run

1. Install dependencies: `npm install`
2. Start dev server: `npm run dev`
3. Open the app and paste your AI API key in the home screen.

Notes:
- If you select an OpenAI-compatible provider, the target API must allow browser requests (CORS). Many providers block this.

### Build

`npm run build`

### Deploy (GitHub Pages)

This app can be deployed as static files.

1. In GitHub, go to **Settings → Pages**.
2. Set **Build and deployment** to **GitHub Actions**.
3. Push this repo to GitHub; the included workflow at `.github/workflows/deploy.yml` will build and deploy on pushes to `main`.

Important:
- Your AI key is not bundled into the build. Each user must paste their own key inside the app.

