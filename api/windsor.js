// Vercel Serverless Function — proxies requests to Windsor.ai
// API key stored in Vercel env var WINDSOR_API_KEY
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.WINDSOR_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'WINDSOR_API_KEY not configured' });

  try {
    const params = req.method === 'POST' ? req.body : req.query;
    const { endpoint, connector, fields, date_preset, date_from, date_to, accounts, ...rest } = params || {};

    // Discover accounts: pull minimal data to extract account_name/account_id
    if (endpoint === 'connectors') {
      const results = [];
      for (const conn of ['facebook', 'shopify']) {
        try {
          const qs = new URLSearchParams({
            api_key: API_KEY,
            connector: conn,
            fields: 'account_name,account_id,date',
            date_preset: 'last_7d'
          });
          const r = await fetch('https://connectors.windsor.ai/all?' + qs);
          const data = await r.json();
          // Extract unique accounts
          const seen = new Set();
          const accs = [];
          (data.data || data || []).forEach(row => {
            const id = row.account_id || row.account_name;
            if (id && !seen.has(id)) {
              seen.add(id);
              accs.push({ account_id: row.account_id, name: row.account_name, account_name: row.account_name, connector: conn });
            }
          });
          results.push({ connector: conn, accounts: accs });
        } catch (e) {
          results.push({ connector: conn, accounts: [], error: e.message });
        }
      }
      return res.status(200).json(results);
    }

    // Data endpoint
    if (endpoint === 'data') {
      const qs = new URLSearchParams({ api_key: API_KEY });
      if (connector) qs.set('connector', connector);
      if (fields) qs.set('fields', fields);
      if (date_preset) qs.set('date_preset', date_preset);
      if (date_from) qs.set('date_from', date_from);
      if (date_to) qs.set('date_to', date_to);
      if (accounts) qs.set('accounts', accounts);
      Object.entries(rest).forEach(([k, v]) => { if (v) qs.set(k, v); });
      const r = await fetch('https://connectors.windsor.ai/all?' + qs);
      const data = await r.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Use endpoint=connectors or endpoint=data' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
