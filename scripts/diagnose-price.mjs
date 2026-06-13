// Diagnostic: fetch an Amazon page and dump all price-related elements
// Usage: node scripts/diagnose-price.mjs B0FKHC8PPV

import { chromium } from 'playwright'

const asin = process.argv[2] || 'B0FKHC8PPV'
const url = `https://www.amazon.com/dp/${asin}`

console.log(`Fetching ${url} ...`)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
await page.waitForTimeout(3000)

const html = await page.content()

console.log('\n=== JSON-LD Scripts ===')
const ldScripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
if (ldScripts) {
  for (const s of ldScripts) {
    const inner = s.replace(/<[^>]*>/g, '')
    try {
      const parsed = JSON.parse(inner)
      console.log(JSON.stringify(parsed, null, 2))
    } catch { console.log('(parse failed, raw):', inner.slice(0, 500)) }
  }
} else {
  console.log('NONE FOUND')
}

console.log('\n=== ALL .a-offscreen elements ===')
const offscreen = html.match(/<span[^>]*class=["'][^"']*a-offscreen[^"']*["'][^>]*>[^<]*<\/span>/gi)
if (offscreen) offscreen.forEach((s, i) => console.log(`  [${i}]`, s.replace(/<[^>]*>/g, '').trim()))

console.log('\n=== corePriceDisplay ===')
const coreDiv = html.match(/<div[^>]*id=["']corePrice[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
console.log(coreDiv ? coreDiv[0].slice(0, 2000) : 'NOT FOUND')

console.log('\n=== price_inside_buybox ===')
const buybox = html.match(/<span[^>]*id=["']price_inside_buybox["'][^>]*>([\s\S]*?)<\/span>/i)
console.log(buybox ? buybox[0] : 'NOT FOUND')

console.log('\n=== .a-price elements (first 5) ===')
const aPrice = html.match(/<span[^>]*class=["'][^"]*a-price[^"']*["'][^>]*>[\s\S]*?<\/span>/gi)
if (aPrice) aPrice.slice(0, 5).forEach((s, i) => {
  const clean = s.replace(/\s+/g, ' ').slice(0, 300)
  console.log(`  [${i}]`, clean)
})

console.log('\n=== ALL price-like spans ===')
const allSpans = html.match(/<span[^>]*>[\s]*\$[\d,.]+[\s]*<\/span>/gi)
if (allSpans) {
  const unique = [...new Set(allSpans.map((s) => s.replace(/<[^>]*>/g, '').trim()))]
  console.log('  Unique prices:', unique.join(', '))
}

await browser.close()
