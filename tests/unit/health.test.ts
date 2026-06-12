import { describe, it, expect } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/ipc'

describe('IPC Channels', () => {
  it('should define HEALTH_CHECK channel', () => {
    expect(IPC_CHANNELS.HEALTH_CHECK).toBe('health:check')
  })
})

describe('Health Check Result type validation', () => {
  it('should have the correct shape', () => {
    const result = {
      status: 'ok' as const,
      timestamp: '2026-01-01T00:00:00.000Z',
      electronVersion: '33.0.0',
      nodeVersion: '22.0.0',
      platform: 'win32'
    }

    expect(result.status).toBe('ok')
    expect(typeof result.timestamp).toBe('string')
    expect(typeof result.electronVersion).toBe('string')
    expect(typeof result.nodeVersion).toBe('string')
    expect(typeof result.platform).toBe('string')
  })
})
