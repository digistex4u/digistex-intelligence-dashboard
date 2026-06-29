const ACCOUNTS = {
  hoq:        '404-716-0856',
  pramogh:    '725-826-2150',
  aenak:      '624-689-0842',
  heatronics: '492-700-2413'
};

export default async function handler(req, res) {
  const { brand, view, from, to, campaign } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });

  const account = ACCOUNTS[brand];
  if (!account) return res.status(400).json({ error: 'unknown brand' });

  const KEY = process.env.WINDSOR_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'missing WINDSOR_API_KEY' });

  try {
    const fields = 'campaign,product_title,spend,clicks,impressions,conversions,conversion_value,date,account_id';
    const url = `https://connectors.windsor.ai/all?` + new URLSearchParams({
      api_key: KEY, connector: 'google_ads', date_preset: 'custom',
      from, to, fields
    }).toString();

    const r = await fetch(url);
    if (!r.ok) throw new Error(`Windsor ${r.status}`);
    const raw = await r.json();
    const rows = (raw.data || []).filter(r => {
      const aid = String(r.account_id || '').replace(/\D/g, '');
      const want = account.replace(/\D/g, '');
      return aid === want;
    });

    if (view === 'list') {
      return res.json(buildList(rows));
    } else if (view === 'detail' && campaign) {
      return res.json(buildDetail(rows, campaign, from, to));
    }
    return res.status(400).json({ error: 'view=list or view=detail&campaign=NAME required' });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function buildList(rows) {
  const map = {};
  rows.forEach(r => {
    const c = r.campaign || 'Unknown';
    if (!map[c]) map[c] = { campaign: c, spend: 0, clicks: 0, impressions: 0, conversions: 0, value: 0, products: new Set() };
    map[c].spend += (+r.spend || 0);
    map[c].clicks += (+r.clicks || 0);
    map[c].impressions += (+r.impressions || 0);
    map[c].conversions += (+r.conversions || 0);
    map[c].value += (+r.conversion_value || 0);
    if (r.product_title) map[c].products.add(r.product_title);
  });
  const campaigns = Object.values(map)
    .map(c => ({ ...c, products: c.products.size, roas: c.spend ? c.value / c.spend : 0 }))
    .sort((a, b) => b.spend - a.spend);
  return { campaigns };
}

function buildDetail(rows, campaign, from, to) {
  const campRows = rows.filter(r => (r.campaign || '') === campaign);
  const weeks = getWeekBoundaries(from, to);

  // Total clicks per week (for click share calculation)
  const weekTotalClicks = {};
  weeks.forEach(w => { weekTotalClicks[w.key] = 0; });

  // Group by product × week
  const prodMap = {};
  campRows.forEach(r => {
    const title = r.product_title || 'Unknown';
    const wk = dateToWeek(r.date, weeks);
    if (!wk) return;

    if (!prodMap[title]) {
      prodMap[title] = { title, t_spend: 0, t_clicks: 0, t_conv: 0, t_val: 0, weeks: {} };
      weeks.forEach(w => { prodMap[title].weeks[w.key] = { spend: 0, clicks: 0, impr: 0, conv: 0, value: 0 }; });
    }
    const pw = prodMap[title].weeks[wk];
    const sp = +r.spend || 0, cl = +r.clicks || 0, im = +r.impressions || 0;
    const cv = +r.conversions || 0, vl = +r.conversion_value || 0;
    pw.spend += sp; pw.clicks += cl; pw.impr += im; pw.conv += cv; pw.value += vl;
    prodMap[title].t_spend += sp; prodMap[title].t_clicks += cl;
    prodMap[title].t_conv += cv; prodMap[title].t_val += vl;
    weekTotalClicks[wk] = (weekTotalClicks[wk] || 0) + cl;
  });

  // Compute click share per product per week
  const products = Object.values(prodMap).map(p => {
    const wdata = weeks.map(w => {
      const pw = p.weeks[w.key];
      const tc = weekTotalClicks[w.key] || 0;
      return {
        week: w.key, label: w.label, from: w.from, to: w.to,
        spend: round(pw.spend), clicks: pw.clicks,
        click_share: tc ? round(pw.clicks / tc * 100, 1) : 0,
        conv: round(pw.conv, 1), value: round(pw.value),
        roas: pw.spend ? round(pw.value / pw.spend, 2) : 0
      };
    });
    return {
      title: p.title, t_spend: round(p.t_spend), t_clicks: p.t_clicks,
      t_conv: round(p.t_conv, 1), t_val: round(p.t_val),
      t_roas: p.t_spend ? round(p.t_val / p.t_spend, 2) : 0,
      weeks: wdata
    };
  }).sort((a, b) => b.t_spend - a.t_spend);

  // Campaign-level weekly totals
  const weekTotals = weeks.map(w => {
    let spend = 0, clicks = 0, impr = 0, conv = 0, value = 0;
    campRows.forEach(r => {
      if (dateToWeek(r.date, weeks) !== w.key) return;
      spend += +r.spend || 0; clicks += +r.clicks || 0;
      impr += +r.impressions || 0; conv += +r.conversions || 0; value += +r.conversion_value || 0;
    });
    return {
      week: w.key, label: w.label, from: w.from, to: w.to,
      spend: round(spend), clicks, impr, conv: round(conv, 1), value: round(value),
      roas: spend ? round(value / spend, 2) : 0
    };
  });

  return { campaign, weeks: weeks.map(w => ({ key: w.key, label: w.label, from: w.from, to: w.to })), weekTotals, products };
}

function getWeekBoundaries(from, to) {
  const weeks = [];
  let d = new Date(from);
  // Align to Monday
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);

  const end = new Date(to);
  while (d <= end) {
    const wStart = new Date(d);
    const wEnd = new Date(d); wEnd.setDate(wEnd.getDate() + 6);
    const iso = dt => dt.toISOString().slice(0, 10);
    const ML = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    weeks.push({
      key: iso(wStart),
      from: iso(wStart),
      to: iso(wEnd > end ? end : wEnd),
      label: `${wStart.getDate()} ${ML[wStart.getMonth()]}`
    });
    d.setDate(d.getDate() + 7);
  }
  return weeks;
}

function dateToWeek(dateStr, weeks) {
  if (!dateStr) return null;
  const d = dateStr.slice(0, 10);
  for (const w of weeks) {
    if (d >= w.from && d <= w.to) return w.key;
  }
  return null;
}

function round(n, dp = 0) { return Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp); }
