import { describe, expect, it } from 'vitest'
import { parseDesktopHandoff } from '../src/lib/desktopHandoff'

describe('desktop handoff', () => {
  it('accepts a loopback callback with a strong state value', () => {
    const state = 'A'.repeat(43)
    const params = new URLSearchParams({ desktop_port: '49152', state, mode: 'register' })

    expect(parseDesktopHandoff(params)).toEqual({
      callbackUrl: 'http://127.0.0.1:49152/auth/callback',
      state,
      initialMode: 'register',
    })
  })

  it('rejects privileged, malformed, and out-of-range ports', () => {
    const state = 'B'.repeat(43)

    expect(parseDesktopHandoff(new URLSearchParams({ desktop_port: '80', state }))).toBeNull()
    expect(parseDesktopHandoff(new URLSearchParams({ desktop_port: 'abc', state }))).toBeNull()
    expect(parseDesktopHandoff(new URLSearchParams({ desktop_port: '70000', state }))).toBeNull()
  })

  it('rejects weak state values', () => {
    expect(
      parseDesktopHandoff(new URLSearchParams({ desktop_port: '49152', state: 'short' })),
    ).toBeNull()
  })
})
