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

    // Debug endpoint — see raw Windsor response
    if (endpoint === 'debug') {
      const qs = new URLSearchParams({ api_key: API_KEY, connector: 'facebook', fields: 'source,account_name,spend,date', date_preset: 'last_7d' });
      const r = await fetch('https://connectors.windsor.ai/all?' + qs);
      const raw = await r.text();
      return res.status(200).json({ raw_response: raw.slice(0, 3000), status: r.status });
    }

    if (endpoint === 'connectors') {
      const results = [];
      for (const conn of ['facebook', 'shopify']) {
        try {
          const qs = new URLSearchParams({ api_key: API_KEY, connector: conn, fields: 'source,account_name,account_id,spend,date', date_preset: 'last_7d' });
          const r = await fetch('https://connectors.windsor.ai/all?' + qs);
          const raw = await r.text();
          let data;
          try { data = JSON.parse(raw); } catch { data = { _parse_error: true, _raw: raw.slice(0, 500) }; }

          let rows = [];
          if (Array.isArray(data)) rows = data;
          else if (data && Array.isArray(data.data)) rows = data.data;
          else if (data && data.message) {
            // Windsor returns { message: "..." } which could be an error or could be data
            results.push({ connector: conn, accounts: [], _message: data.message });
            continue;
          }

          const seen = new Set();
          const accs = [];
          rows.forEach(row => {
            if (!row || typeof row !== 'object') return;
            const id = String(row.account_id || row.account_name || row.source || '');
            if (id && !seen.has(id)) {
              seen.add(id);
              accs.push({ account_id: row.account_id || id, name: row.account_name || row.source || id, account_name: row.account_name || row.source || id, connector: conn });
            }
          });
          results.push({ connector: conn, accounts: accs });
        } catch (e) {
          results.push({ connector: conn, accounts: [], error: e.message });
        }
      }
      return res.status(200).json(results);
    }

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
      const raw = await r.text();
      let data;
      try { data = JSON.parse(raw); } catch { return res.status(200).json({ data: [], _raw: raw.slice(0, 500) }); }
      if (Array.isArray(data)) return res.status(200).json({ data });
      if (data && Array.isArray(data.data)) return res.status(200).json(data);
      return res.status(200).json({ data: [], _response: data });
    }

    return res.status(400).json({ error: 'Use endpoint=connectors, endpoint=data, or endpoint=debug' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
