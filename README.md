# Digistex Multi-Brand Intelligence Dashboard

Live performance analytics across Meta Ads & Shopify via Windsor.ai. Built for agency-scale multi-brand management.

## Features

| Tab | What it does |
|-----|-------------|
| **Scorecard** | 8 KPIs with period-over-period deltas, trajectory detection |
| **90-Day Rolling** | Three 30-day windows with funnel comparison |
| **Weekly Cycles** | Week 1–4 cyclicality analysis (salary-cycle patterns) |
| **Ad Fatigue** | Day-by-day CPM/frequency/reach trends, KILL/PAUSE/WATCH alerts |
| **Collections** | URL-parsed collection mapping with per-collection ROAS |
| **State Analysis** | Shopify shipping-province revenue (not Meta's unreliable state data) |
| **Creative Intel** | 8-dimension scoring engine: SCALE / OPTIMIZE / WATCH / KILL |

## Deploy to Vercel (recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/digistex4u/digistex-intelligence-dashboard)

1. Click the button above (or import from GitHub)
2. Add environment variable: `WINDSOR_API_KEY` = your Windsor.ai API key
3. Deploy — done. The serverless proxy in `/api/windsor.js` keeps your key server-side.

## Run Locally

Just open `public/index.html` in a browser. It will prompt for your Windsor.ai API key, encrypt it with AES-256-GCM, and store it in localStorage.

## Architecture

```
├── api/
│   └── windsor.js          # Vercel serverless proxy (keeps API key server-side)
├── public/
│   └── index.html           # Full dashboard (CSS + JS, zero dependencies)
└── vercel.json              # Vercel config
```

**Dual mode:** The dashboard tries the Vercel proxy first (`/api/windsor`). If that fails (e.g. running locally), it falls back to direct Windsor.ai API calls using the encrypted client-side key.

## Windsor.ai Fields Used

- **Meta (facebook):** spend, impressions, clicks, ctr, cpm, frequency, actions_purchase, action_values_purchase, actions_add_to_cart, actions_initiate_checkout, video hooks, website_destination_url
- **Shopify:** order_count, order_total_price, order_shipping_province, order_financial_status, order_sales_channel

## Security

- API key encrypted with AES-256-GCM (PBKDF2 key derivation, 100k iterations)
- Stored in browser localStorage only when using direct mode
- On Vercel: key lives in environment variables, never reaches the client

---

*Digistex Performance Marketing · Powered by Windsor.ai*
