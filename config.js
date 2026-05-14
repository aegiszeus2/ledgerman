// Ledgerman — API Configuration
// Deployment: GitHub → Render (all services)
// Frontend:   https://ledgerman.org        (Render static site — ledgerman repo)
// Backend:    https://app.ledgerman.org    (Render web service — ledgeman-backend repo)
// API calls:  routed through Cloudflare Worker (ledgerman.org/api/* → app.ledgerman.org/api/*)
//             same-origin — no cross-origin fetch, works in all browsers including Edge
// Cache bust: v20260514-1

window.LEDGERMAN_API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5001'
    : window.location.origin;
