import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom renders of the full calculator are slow; the default 5s limit is too tight.
    testTimeout: 20000,
  },
})
