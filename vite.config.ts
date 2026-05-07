import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    crx({ manifest }),
  ],
  server: {
    host: true,
    port: 3003,
    strictPort: true,
    watch: {
      // The auto-backup feature writes `plot-backup.json` to a folder the
      // user picks. If they pick a folder inside the project, vite would
      // otherwise see the write and full-reload the page on every backup,
      // which loops forever (load → state set → debounced write → reload).
      // Ignoring the file name here breaks that loop regardless of where
      // the user puts their backup folder.
      ignored: ['**/plot-backup.json'],
    },
  },
})
