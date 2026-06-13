// Test the parser against a real Amazon page
import { chromium } from 'playwright'

const re = /apex-pricetopay-value[^>]*>[\s\S]*?a-offscreen[^>]*>\s*\$?([\d,]+\.?\d*)/i

const asin = process.argv[2] || 'B0FKHC8PPV'
const url = `https://www.amazon.com/dp/${asin}`

console.log(`Testing ${asin} ...`)

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
await page.waitForTimeout(3000)
const html = await page.content()
await browser.close()

// Test regex
const m = html.match(re)
console.log('Parser price:', m ? `$${m[1]}` : 'NO MATCH')

// Also check apex
const apex = html.match(/apex-pricetopay-value/)
console.log('apex-pricetopay-value found:', !!apex)

// Show first 3 .a-offscreen
const all = html.match(/<span[^>]*class="[^"]*a-offscreen[^"]*"[^>]*>[^<]*<\/span>/gi)
console.log('First 3 a-offscreen:')
if (all) all.slice(0, 3).forEach((s, i) => console.log(`  [${i}]`, s.replace(/<[^>]*>/g, '').trim()))
