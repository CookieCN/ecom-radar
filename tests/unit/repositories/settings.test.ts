import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb } from '../../helpers/db'
import { SettingsRepository } from '../../../src/data/repositories/settings'

describe('SettingsRepository', () => {
  let db: Database.Database
  let repo: SettingsRepository

  beforeEach(() => {
    db = createTestDb()
    repo = new SettingsRepository(db)
  })

  afterEach(() => {
    db.close()
  })

  describe('get / set', () => {
    it('should set and get a value', () => {
      repo.set('theme', 'dark')
      expect(repo.get('theme')).toBe('dark')
    })

    it('should return undefined for missing key', () => {
      expect(repo.get('nonexistent')).toBeUndefined()
    })

    it('should overwrite existing key', () => {
      repo.set('key', 'old')
      repo.set('key', 'new')
      expect(repo.get('key')).toBe('new')
    })
  })

  describe('getOrDefault', () => {
    it('should return default for missing key', () => {
      expect(repo.getOrDefault('missing', 'default')).toBe('default')
    })

    it('should return value for existing key', () => {
      repo.set('existing', 'value')
      expect(repo.getOrDefault('existing', 'default')).toBe('value')
    })
  })

  describe('setMultiple', () => {
    it('should set multiple entries at once', () => {
      repo.setMultiple({ a: '1', b: '2', c: '3' })
      expect(repo.get('a')).toBe('1')
      expect(repo.get('b')).toBe('2')
      expect(repo.get('c')).toBe('3')
    })
  })

  describe('delete', () => {
    it('should delete a key', () => {
      repo.set('temp', 'val')
      repo.delete('temp')
      expect(repo.get('temp')).toBeUndefined()
    })
  })

  describe('getAll / getAllAsMap', () => {
    it('should return all settings', () => {
      repo.set('a', '1')
      repo.set('b', '2')
      const all = repo.getAll()
      expect(all).toHaveLength(2)
    })

    it('should return all as map', () => {
      repo.set('a', '1')
      const map = repo.getAllAsMap()
      expect(map.a).toBe('1')
    })
  })

  describe('getBoolean / setBoolean', () => {
    it('should handle boolean values', () => {
      repo.setBoolean('enabled', true)
      expect(repo.getBoolean('enabled')).toBe(true)

      repo.setBoolean('enabled', false)
      expect(repo.getBoolean('enabled')).toBe(false)
    })

    it('should return default for missing boolean', () => {
      expect(repo.getBoolean('missing', true)).toBe(true)
      expect(repo.getBoolean('missing', false)).toBe(false)
    })
  })

  describe('getNumber / setNumber', () => {
    it('should handle number values', () => {
      repo.setNumber('interval', 360)
      expect(repo.getNumber('interval')).toBe(360)
    })

    it('should return default for missing number', () => {
      expect(repo.getNumber('missing', 100)).toBe(100)
    })

    it('should return default for invalid number', () => {
      repo.set('invalid', 'not-a-number')
      expect(repo.getNumber('invalid', 50)).toBe(50)
    })
  })
})
