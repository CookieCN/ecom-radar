import { describe, expect, it } from 'vitest'
import {
  MARKETPLACE_CONFIGS,
  getDeliverySettingKey,
  getMarketplaceByDomain,
  getMarketplaceConfig
} from '../../src/shared/marketplaces'

const EXPECTED_MARKETPLACES = [
  ['US', 'amazon.com', 'USD', 'en-US', 'America/New_York', '10001'],
  ['CA', 'amazon.ca', 'CAD', 'en-CA', 'America/Toronto', 'M5V 3L9'],
  ['MX', 'amazon.com.mx', 'MXN', 'es-MX', 'America/Mexico_City', '06600'],
  ['BR', 'amazon.com.br', 'BRL', 'pt-BR', 'America/Sao_Paulo', '01310-100'],
  ['UK', 'amazon.co.uk', 'GBP', 'en-GB', 'Europe/London', 'SW1A 1AA'],
  ['DE', 'amazon.de', 'EUR', 'de-DE', 'Europe/Berlin', '47495'],
  ['FR', 'amazon.fr', 'EUR', 'fr-FR', 'Europe/Paris', '75001'],
  ['IT', 'amazon.it', 'EUR', 'it-IT', 'Europe/Rome', '00118'],
  ['ES', 'amazon.es', 'EUR', 'es-ES', 'Europe/Madrid', '28001'],
  ['JP', 'amazon.co.jp', 'JPY', 'ja-JP', 'Asia/Tokyo', '100-0001'],
  ['IN', 'amazon.in', 'INR', 'en-IN', 'Asia/Kolkata', '110001'],
  ['AU', 'amazon.com.au', 'AUD', 'en-AU', 'Australia/Sydney', '2000'],
  ['AE', 'amazon.ae', 'AED', 'en-AE', 'Asia/Dubai', 'Dubai']
] as const

const POSTAL_CODE_PATTERNS: Readonly<Record<string, RegExp>> = {
  US: /^\d{5}$/,
  CA: /^[A-Z]\d[A-Z] \d[A-Z]\d$/,
  MX: /^\d{5}$/,
  BR: /^\d{5}-\d{3}$/,
  UK: /^[A-Z0-9]+ \d[A-Z]{2}$/,
  DE: /^\d{5}$/,
  FR: /^\d{5}$/,
  IT: /^\d{5}$/,
  ES: /^\d{5}$/,
  JP: /^\d{3}-\d{4}$/,
  IN: /^\d{6}$/,
  AU: /^\d{4}$/
}

describe('marketplace configuration', () => {
  it('defines unique delivery and currency profiles for every supported marketplace', () => {
    expect(MARKETPLACE_CONFIGS).toHaveLength(13)
    expect(new Set(MARKETPLACE_CONFIGS.map((config) => config.code)).size).toBe(13)
    for (const config of MARKETPLACE_CONFIGS) {
      expect(config.currency).toMatch(/^[A-Z]{3}$/)
      expect(config.defaultLocation.length).toBeGreaterThan(0)
      expect(config.locale.length).toBeGreaterThan(0)
      expect(config.timezoneId.length).toBeGreaterThan(0)
    }
  })

  it('maps Germany to EUR and a German delivery context', () => {
    expect(getMarketplaceConfig('DE')).toMatchObject({
      domain: 'amazon.de',
      currency: 'EUR',
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
      defaultLocation: '47495'
    })
    expect(getMarketplaceByDomain('www.amazon.de')?.code).toBe('DE')
  })

  it.each(EXPECTED_MARKETPLACES)(
    '%s has the accepted domain, currency, locale, timezone, and delivery baseline',
    (code, domain, currency, locale, timezoneId, defaultLocation) => {
      const config = getMarketplaceConfig(code)
      expect(config).toMatchObject({
        code,
        domain,
        currency,
        locale,
        timezoneId,
        defaultLocation
      })
      expect(getMarketplaceByDomain(`www.${domain}`)?.code).toBe(code)
      expect(getDeliverySettingKey(code.toLowerCase())).toBe(`delivery_location.${code}`)
      const timezoneFormatter = Intl.DateTimeFormat(locale, {
        timeZone: timezoneId,
        timeZoneName: 'longOffset'
      })
      expect(timezoneFormatter.resolvedOptions().timeZone).toBeTruthy()
      expect(
        timezoneFormatter.formatToParts(new Date()).some((part) => part.type === 'timeZoneName')
      ).toBe(true)
      expect(
        Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions().currency
      ).toBe(currency)
    }
  )

  it('uses a valid local postal-code format for every postal-code marketplace', () => {
    for (const config of MARKETPLACE_CONFIGS) {
      if (config.locationMode === 'city') {
        expect(config.code).toBe('AE')
        expect(config.defaultLocation).toBe('Dubai')
        continue
      }

      expect(config.defaultLocation).toMatch(POSTAL_CODE_PATTERNS[config.code])
    }
  })
})
