# Freelancer Monitor Extension

Standalone Manifest V3 Chrome extension built with Vite, React, and TypeScript.

```sh
npm install
npm run build:local   # local API
# or npm run build    # production API
```

Load the generated `dist` directory from Chrome's **Extensions > Developer mode > Load unpacked**. Enter the API key in the popup; it is saved only in `chrome.storage.local`, never compiled into the bundle.

Run `npm run typecheck` and `npm test` for verification.
