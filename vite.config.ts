import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Allow static hosts like GitHub Pages (served at /<repo>/) without hard-coding.
  // In CI we set VITE_BASE to /<repo>/.
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_BASE || '/'

  return {
    base,
    plugins: [react()],
    server: {
      // Avoid colliding with other local dev services
      port: 5175,
      strictPort: true,
    },
  }
})
