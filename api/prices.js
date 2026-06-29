const SHOPS = {
  hoq:        'housee-of-qalakarii.myshopify.com',
  pramogh:    'pramogh.myshopify.com',
  aenak:      '307f45-04.myshopify.com',
  heatronics: 'heatronicss.myshopify.com'
};

export default async function handler(req, res) {
  const { brand } = req.query;
  const domain = SHOPS[brand];
  if (!domain) return res.status(400).json({ error: 'unknown brand' });

  try {
    let products = [];
    let url = `https://${domain}/products.json?limit=250`;

    for (let page = 0; page < 5; page++) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Shopify ${r.status}`);
      const data = await r.json();
      products = products.concat(data.products || []);

      const link = r.headers.get('link') || '';
      const next = link.match(/<([^>]+)>;\s*rel="next"/);
      if (!next || (data.products || []).length < 250) break;
      url = next[1];
    }

    const items = products.map(p => {
      const vs = p.variants || [];
      const prices = vs.map(v => parseFloat(v.price) || 0).filter(x => x > 0);
      const mrps   = vs.map(v => parseFloat(v.compare_at_price) || 0).filter(x => x > 0);
      return {
        title:     p.title,
        handle:    p.handle,
        price:     prices.length ? Math.min(...prices) : 0,
        max_price: prices.length ? Math.max(...prices) : 0,
        mrp:       mrps.length   ? Math.max(...mrps)   : null,
        variants:  vs.length
      };
    });

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    res.json({ products: items, count: items.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
