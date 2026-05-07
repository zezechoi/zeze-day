// Fetches Google News RSS for each category and writes news.json
// Runs in GitHub Actions (Node 20+) — server-side fetch, no CORS

import { writeFileSync } from 'node:fs';

const QUERIES = {
  beauty: 'K뷰티 OR 화장품 산업',
  global: 'K뷰티 해외 OR 글로벌 뷰티',
  sns:    '인스타그램 마케팅 OR 틱톡 트렌드',
  ai:     'AI 마케팅 OR 생성형 AI',
};
const TAGS = { beauty: '뷰티트렌드', global: '글로벌', sns: 'SNS', ai: 'AI' };
const PER_CATEGORY = 5;

const decodeXml = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');

function parseItems(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const inner = m[1];
    const grab = (tag) => {
      const found = inner.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
      return found ? decodeXml(found[1]).trim() : '';
    };
    items.push({
      rawTitle: grab('title'),
      link: grab('link'),
      pubDate: grab('pubDate'),
    });
  }
  return items;
}

async function fetchCategory(key) {
  const query = QUERIES[key];
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  return parseItems(xml).slice(0, PER_CATEGORY).map((it) => {
    const m = it.rawTitle.match(/^(.+?) - ([^-]+)$/);
    const title = m ? m[1].trim() : it.rawTitle;
    const source = m ? m[2].trim() : '';
    const d = it.pubDate ? new Date(it.pubDate) : null;
    const date = d && !isNaN(d) ? `${d.getMonth() + 1}/${d.getDate()}` : '';
    const summary = [source, date].filter(Boolean).join(' · ');
    return { title, summary, tag: TAGS[key], url: it.link };
  });
}

const result = { updated: new Date().toISOString() };
for (const k of Object.keys(QUERIES)) {
  try {
    result[k] = await fetchCategory(k);
    console.log(`✓ ${k}: ${result[k].length} items`);
  } catch (err) {
    console.error(`✗ ${k}: ${err.message}`);
    result[k] = [];
  }
}
writeFileSync('news.json', JSON.stringify(result, null, 2));
console.log(`\nWrote news.json (${Object.keys(QUERIES).reduce((s, k) => s + result[k].length, 0)} total items)`);
