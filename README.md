# Trans-Vid

React 18+ · Vite · Tailwind · Three.js · GSAP · Lucide

    npm install
    npm run dev      # development
    npm run build    # production build
    npm test         # parser + webhook-service tests (Node, no browser)

Webhook URL and timeout live in `src/config/constants.js`.
The n8n server's CORS policy must allow the origin this app is served from.
