export interface ParsedStoreProfile {
  name: string | null
  logoUrl: string | null
  publicRating: number | null
  feedbackCount: number | null
  positive30d: number | null
  positive90d: number | null
  positive365d: number | null
}

export interface ParsedStoreProductCard {
  asin: string
  title: string | null
  imageUrl: string | null
  price: number | null
  currency: string | null
  rating: number | null
  reviewCount: number | null
}

export interface ParsedStoreListing {
  products: ParsedStoreProductCard[]
  reportedProductCount: number | null
}

export function parseStoreProfile(html: string): ParsedStoreProfile {
  const title = firstText(html, [
    /id=["']sellerName["'][^>]*>([\s\S]*?)<\//i,
    /class=["'][^"']*seller-name[^"']*["'][^>]*>([\s\S]*?)<\//i,
    /<h1[^>]*>([\s\S]*?)<\/h1>/i
  ])
  const logoTag = html.match(
    /<img\b[^>]*(?:id=["']seller-logo["']|class=["'][^"']*seller-logo[^"']*)[^>]*>/i
  )?.[0]
  const publicRating = numberFrom(html, /([\d.,]+)\s*(?:out of 5|von 5|sur 5|／5)/i)
  const feedbackCount = integerFrom(
    html,
    /([\d.,\s]+)\s*(?:ratings|feedback|Bewertungen|évaluations|評価)/i
  )

  return {
    name: title,
    logoUrl: logoTag ? attribute(logoTag, 'src') : null,
    publicRating,
    feedbackCount,
    positive30d: feedbackRate(html, ['30 days', '30 Tage', '30 jours', '30日']),
    positive90d: feedbackRate(html, ['90 days', '90 Tage', '90 jours', '90日']),
    positive365d: feedbackRate(html, ['12 months', '365 days', '12 Monate', '12 mois', '12か月'])
  }
}

export function parseStoreListing(html: string): ParsedStoreListing {
  const products: ParsedStoreProductCard[] = []
  const seen = new Set<string>()
  const cardPattern = /<([a-z][\w-]*)\b[^>]*data-asin=["']([A-Z0-9]{10})["'][^>]*>[\s\S]*?<\/\1>/gi
  let match: RegExpExecArray | null
  while ((match = cardPattern.exec(html)) !== null) {
    const asin = match[2]
    if (seen.has(asin)) continue
    seen.add(asin)
    const card = match[0]
    const imageTag = card.match(/<img\b[^>]*>/i)?.[0]
    products.push({
      asin,
      title:
        imageTag && attribute(imageTag, 'alt')
          ? attribute(imageTag, 'alt')
          : firstText(card, [
              /<h2[^>]*>([\s\S]*?)<\/h2>/i,
              /class=["'][^"']*a-text-normal[^"']*["'][^>]*>([\s\S]*?)<\//i
            ]),
      imageUrl: imageTag ? attribute(imageTag, 'src') : null,
      price: localizedPrice(
        firstText(card, [/class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)</i])
      ),
      currency: currencyFrom(card),
      rating: numberFrom(card, /([\d.,]+)\s*(?:out of 5|von 5|sur 5|／5)/i),
      reviewCount: integerFrom(
        card,
        /(?:aria-label=["'][^"']*["'][^>]*>|class=["'][^"']*s-underline-text[^"']*["'][^>]*>)\s*([\d.,\s]+)\s*</i
      )
    })
  }

  return {
    products,
    reportedProductCount: integerFrom(
      html,
      /(?:of|von|sur|件中)\s+(?:over\s+)?([\d.,\s]+)\s+(?:results|Ergebnissen|résultats|件)/i
    )
  }
}

function feedbackRate(html: string, labels: string[]): number | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const after = new RegExp(`${escaped}[\\s\\S]{0,500}?([\\d.,]+)\\s*%`, 'i').exec(html)
    if (after) return Number(after[1].replace(',', '.'))
    const before = new RegExp(`([\\d.,]+)\\s*%[\\s\\S]{0,500}?${escaped}`, 'i').exec(html)
    if (before) return Number(before[1].replace(',', '.'))
  }
  return null
}

function firstText(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(html)
    if (match) return clean(match[1]) || null
  }
  return null
}

function attribute(tag: string, name: string): string | null {
  return tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'))?.[1] ?? null
}

function clean(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function numberFrom(html: string, pattern: RegExp): number | null {
  const match = pattern.exec(html)
  if (!match) return null
  const value = Number(match[1].replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

function integerFrom(html: string, pattern: RegExp): number | null {
  const match = pattern.exec(html)
  if (!match) return null
  const value = Number(match[1].replace(/\D/g, ''))
  return Number.isFinite(value) ? value : null
}

function localizedPrice(value: string | null): number | null {
  if (!value) return null
  let cleaned = value.replace(/[^\d.,]/g, '')
  const comma = cleaned.lastIndexOf(',')
  const dot = cleaned.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? ',' : '.'
    cleaned = cleaned.replace(decimal === ',' ? /\./g : /,/g, '').replace(decimal, '.')
  } else if (comma >= 0) {
    cleaned =
      cleaned.length - comma - 1 === 2 ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '')
  }
  const number = Number(cleaned)
  return Number.isFinite(number) ? number : null
}

function currencyFrom(html: string): string | null {
  if (/[$]|USD/i.test(html)) return 'USD'
  if (/[€]|EUR/i.test(html)) return 'EUR'
  if (/[£]|GBP/i.test(html)) return 'GBP'
  if (/[¥￥]|JPY/i.test(html)) return 'JPY'
  return null
}
