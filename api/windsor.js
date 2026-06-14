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

    // Discover accounts by pulling minimal data from each connector
    if (endpoint === 'connectors') {
      const results = [];
      for (const conn of ['facebook', 'shopify']) {
        try {
          const qs = new URLSearchParams({
            api_key: API_KEY,
            fields: 'account_name,account_id,date,spend',
            date_preset: 'last_7d'
          });
          // Connector name goes in the URL PATH, not as a query param
          const url = `https://connectors.windsor.ai/${conn}?${qs}`;
          const r = await fetch(url);
          const raw = await r.text();
          let data;
          try { data = JSON.parse(raw); } catch { data = null; }

          let rows = [];
          if (Array.isArray(data)) rows = data;
          else if (data && Array.isArray(data.data)) rows = data.data;

          const seen = new Set();
          const accs = [];
          rows.forEach(row => {
            if (!row || typeof row !== 'object') return;
            const id = String(row.account_id || row.account_name || '');
            if (id && !seen.has(id)) {
              seen.add(id);
              accs.push({ account_id: row.account_id || id, name: row.account_name || id, account_name: row.account_name || id, connector: conn });
            }
          });
          results.push({ connector: conn, accounts: accs });
        } catch (e) {
          results.push({ connector: conn, accounts: [], error: e.message });
        }
      }
      return res.status(200).json(results);
    }

    // Data endpoint — connector name in URL path
    if (endpoint === 'data') {
      const qs = new URLSearchParams({ api_key: API_KEY });
      if (fields) qs.set('fields', fields);
      if (date_preset) qs.set('date_preset', date_preset);
      if (date_from) qs.set('date_from', date_from);
      if (date_to) qs.set('date_to', date_to);
      if (accounts) qs.set('accounts', accounts);
      Object.entries(rest).forEach(([k, v]) => { if (v) qs.set(k, v); });
      // Use connector-specific path or /all for blended
      const path = connector || 'all';
      const url = `https://connectors.windsor.ai/${path}?${qs}`;
      const r = await fetch(url);
      const raw = await r.text();
      let data;
      try { data = JSON.parse(raw); } catch { return res.status(200).json({ data: [], _raw: raw.slice(0, 500) }); }
      if (Array.isArray(data)) return res.status(200).json({ data });
      if (data && Array.isArray(data.data)) return res.status(200).json(data);
      return res.status(200).json({ data: [], _response: data });
    }

    return res.status(400).json({ error: 'Use endpoint=connectors or endpoint=data' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
