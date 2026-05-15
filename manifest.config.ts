import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest(({ command }) => {
  const isDev = command === 'serve'

  return {
    manifest_version: 3,
    name: 'Plot',
    version: '0.0.1',
    description: 'A new tab workspace for tracking projects, decisions, learnings, and delivery.',
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    chrome_url_overrides: {
      newtab: 'index.html',
    },
    permissions: ['storage'],
    ...(isDev
      ? {
          // Dev-only: allow CRX HMR loader to import from the Vite dev server.
          host_permissions: ['http://localhost/*', 'http://127.0.0.1/*'],
          content_security_policy: {
            extension_pages:
              "script-src 'self' http://localhost:3003 http://127.0.0.1:3003; object-src 'self';",
          },
        }
      : {
          content_security_policy: {
            extension_pages: "script-src 'self'; object-src 'self';",
          },
        }),
  }
})
