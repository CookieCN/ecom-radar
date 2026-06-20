export type DeliveryLocationMode = 'postalCode' | 'city'

export interface MarketplaceConfig {
  code: string
  domain: string
  currency: string
  locale: string
  timezoneId: string
  locationMode: DeliveryLocationMode
  defaultLocation: string
}

export const MARKETPLACE_CONFIGS: readonly MarketplaceConfig[] = [
  {
    code: 'US',
    domain: 'amazon.com',
    currency: 'USD',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    locationMode: 'postalCode',
    defaultLocation: '10001'
  },
  {
    code: 'CA',
    domain: 'amazon.ca',
    currency: 'CAD',
    locale: 'en-CA',
    timezoneId: 'America/Toronto',
    locationMode: 'postalCode',
    defaultLocation: 'M5V 3L9'
  },
  {
    code: 'MX',
    domain: 'amazon.com.mx',
    currency: 'MXN',
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    locationMode: 'postalCode',
    defaultLocation: '06600'
  },
  {
    code: 'BR',
    domain: 'amazon.com.br',
    currency: 'BRL',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    locationMode: 'postalCode',
    defaultLocation: '01310-100'
  },
  {
    code: 'UK',
    domain: 'amazon.co.uk',
    currency: 'GBP',
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    locationMode: 'postalCode',
    defaultLocation: 'SW1A 1AA'
  },
  {
    code: 'DE',
    domain: 'amazon.de',
    currency: 'EUR',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    locationMode: 'postalCode',
    defaultLocation: '47495'
  },
  {
    code: 'FR',
    domain: 'amazon.fr',
    currency: 'EUR',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    locationMode: 'postalCode',
    defaultLocation: '75001'
  },
  {
    code: 'IT',
    domain: 'amazon.it',
    currency: 'EUR',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    locationMode: 'postalCode',
    defaultLocation: '00118'
  },
  {
    code: 'ES',
    domain: 'amazon.es',
    currency: 'EUR',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    locationMode: 'postalCode',
    defaultLocation: '28001'
  },
  {
    code: 'JP',
    domain: 'amazon.co.jp',
    currency: 'JPY',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    locationMode: 'postalCode',
    defaultLocation: '100-0001'
  },
  {
    code: 'IN',
    domain: 'amazon.in',
    currency: 'INR',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    locationMode: 'postalCode',
    defaultLocation: '110001'
  },
  {
    code: 'AU',
    domain: 'amazon.com.au',
    currency: 'AUD',
    locale: 'en-AU',
    timezoneId: 'Australia/Sydney',
    locationMode: 'postalCode',
    defaultLocation: '2000'
  },
  {
    code: 'AE',
    domain: 'amazon.ae',
    currency: 'AED',
    locale: 'en-AE',
    timezoneId: 'Asia/Dubai',
    locationMode: 'city',
    defaultLocation: 'Dubai'
  }
]

export function getMarketplaceConfig(code: string): MarketplaceConfig | undefined {
  return MARKETPLACE_CONFIGS.find((config) => config.code === code.toUpperCase())
}

export function getMarketplaceByDomain(hostname: string): MarketplaceConfig | undefined {
  const host = hostname.toLowerCase().replace(/^www\./, '')
  return MARKETPLACE_CONFIGS.find(
    (config) => host === config.domain || host.endsWith(`.${config.domain}`)
  )
}

export function getDeliverySettingKey(code: string): string {
  return `delivery_location.${code.toUpperCase()}`
}
