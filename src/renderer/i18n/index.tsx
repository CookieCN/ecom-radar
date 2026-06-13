import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import en from './en'
import zhCN from './zh-CN'
import type { Translations } from './en'

type Lang = 'en' | 'zh-CN'

const translations: Record<Lang, Translations> = { en, 'zh-CN': zhCN }

const STORAGE_KEY = 'ecom-radar-lang'

function loadLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'zh-CN' || stored === 'en') return stored
  } catch { /* localStorage may not be available */ }
  // Detect browser language
  if (typeof navigator !== 'undefined' && navigator.language?.startsWith('zh')) return 'zh-CN'
  return 'en'
}

function saveLang(lang: Lang): void {
  try { localStorage.setItem(STORAGE_KEY, lang) } catch { /* ignore */ }
}

function t(trans: Translations, key: string, ...args: string[]): string {
  const keys = key.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let val: any = trans
  for (const k of keys) {
    if (val == null) return key
    val = val[k]
  }
  if (typeof val !== 'string') return key
  // Replace {0}, {1}, etc.
  return val.replace(/\{(\d+)\}/g, (_m, i) => args[Number(i)] ?? '')
}

interface I18nContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, ...args: string[]) => string
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (k: string) => k
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadLang)

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    saveLang(l)
  }, [])

  const translate = useCallback(
    (key: string, ...args: string[]) => t(translations[lang], key, ...args),
    [lang]
  )

  return (
    <I18nContext.Provider value={{ lang, setLang, t: translate }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useT() {
  return useContext(I18nContext).t
}

export function useLang() {
  const ctx = useContext(I18nContext)
  return { lang: ctx.lang, setLang: ctx.setLang } as const
}

export type { Translations }
