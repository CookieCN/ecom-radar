import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('renderer content security policy', () => {
  it('allows the Amazon image CDN without allowing arbitrary remote images', () => {
    const html = readFileSync(join(__dirname, '..', '..', 'src', 'renderer', 'index.html'), 'utf-8')

    expect(html).toContain(
      "img-src 'self' data: https://*.media-amazon.com https://*.ssl-images-amazon.com"
    )
    expect(html).not.toMatch(/img-src[^;]*\shttps:(?:\s|;|\")/)
  })
})
