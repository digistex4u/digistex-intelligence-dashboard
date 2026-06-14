/**
 * Vercel Serverless Proxy for Windsor.ai REST API
 * Keeps the WINDSOR_API_KEY server-side — never exposed to the browser.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'WINDSOR_API_KEY not configured in Vercel env vars.' });
  }

  const { connector, ...params } = req.query;
  if (!connector) {
    return res.status(400).json({ error: 'Missing ?connector= parameter. Use facebook, google_ads, or shopify.' });
  }

  const url = new URL(`https://connectors.windsor.ai/${connector}`);
  url.searchParams.set('api_key', apiKey);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  try {
    const upstream = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({
        error: `Windsor ${connector} returned ${upstream.status}`,
        detail: text.slice(0, 500),
      });
    }

    const data = await upstream.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Proxy error: ' + err.message });
  }
}
