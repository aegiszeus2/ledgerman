// Ledgerman — API Configuration
// Deployment: GitHub → Render (all services)
// Frontend:   https://ledgerman.org        (Render static site — ledgerman repo)
// Backend:    https://app.ledgerman.org    (Render web service — ledgeman-backend repo)
// API calls:  same-origin — frontend served from app.ledgerman.org by Flask backend
//             ledgerman.org redirects → app.ledgerman.org via _redirects
//             works in all browsers including Edge (no cross-origin fetch)
// Cache bust: v20260514-2

window.LEDGERMAN_API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5001'
    : window.location.origin;
