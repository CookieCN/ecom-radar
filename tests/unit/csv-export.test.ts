import { describe, it, expect } from 'vitest'

// Test the CSV escaping logic (mirrors the main process helper)
function escapeCsvField(field: string | number | null): string {
  if (field === null || field === undefined) return ''
  const s = String(field)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

describe('CSV field escaping', () => {
  it('returns empty string for null', () => {
    expect(escapeCsvField(null)).toBe('')
  })

  it('returns number as string', () => {
    expect(escapeCsvField(42)).toBe('42')
  })

  it('passes plain text through', () => {
    expect(escapeCsvField('hello')).toBe('hello')
  })

  it('wraps field with comma in quotes', () => {
    expect(escapeCsvField('hello, world')).toBe('"hello, world"')
  })

  it('escapes double quotes', () => {
    expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""')
  })

  it('wraps field with newline in quotes', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
  })

  it('handles price field as number', () => {
    expect(escapeCsvField(19.99)).toBe('19.99')
  })
})

describe('CSV BOM marker', () => {
  it('BOM is U+FEFF', () => {
    const BOM = '﻿'
    expect(BOM.length).toBe(1)
    expect(BOM.charCodeAt(0)).toBe(0xfeff)
  })
})
