// Vercel Serverless Function — proxies requests to Windsor.ai
// API key stored in Vercel environment variable WINDSOR_API_KEY
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.WINDSOR_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'WINDSOR_API_KEY not configured. Add it in Vercel Project Settings → Environment Variables.' });

  try {
    const params = req.method === 'POST' ? req.body : req.query;
    const { endpoint, connector, fields, date_preset, date_from, date_to, accounts, date_filters, ...rest } = params || {};

    // Route: /api/windsor?endpoint=connectors → list connectors
    if (endpoint === 'connectors') {
      const url = `https://connectors.windsor.ai/connectors?api_key=${API_KEY}`;
      const r = await fetch(url);
      const data = await r.json();
      return res.status(200).json(data);
    }

    // Route: /api/windsor?endpoint=data → pull data
    if (endpoint === 'data') {
      const qs = new URLSearchParams({ api_key: API_KEY });
      if (connector) qs.set('connector', connector);
      if (fields) qs.set('fields', fields);
      if (date_preset) qs.set('date_preset', date_preset);
      if (date_from) qs.set('date_from', date_from);
      if (date_to) qs.set('date_to', date_to);
      if (accounts) qs.set('accounts', accounts);
      if (date_filters) qs.set('date_filters', typeof date_filters === 'string' ? date_filters : JSON.stringify(date_filters));
      // Pass any extra params
      Object.entries(rest).forEach(([k, v]) => { if (v) qs.set(k, v); });

      const url = `https://connectors.windsor.ai/all?${qs.toString()}`;
      const r = await fetch(url);
      const data = await r.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Missing endpoint param. Use endpoint=connectors or endpoint=data' });
  } catch (err) {
    console.error('Windsor proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
