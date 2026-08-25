import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseAuthGateway, type AuthSession } from '../src/lib/authGateway'
import { supabase } from '../src/lib/supabase'

const SESSION: AuthSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  user: { id: 'user-1', email: 'allan@example.com' },
}

describe('Supabase auth gateway', () => {
  afterEach(() => vi.restoreAllMocks())

  it('inserts a profile after an ownership-scoped update finds no row', async () => {
    const updateMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const updateSelect = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle })
    const updateEq = vi.fn().mockReturnValue({ select: updateSelect })
    const update = vi.fn().mockReturnValue({ eq: updateEq })
    const upsert = vi.fn(() => {
      throw new Error('profile writes must not use upsert')
    })

    const insertedProfile = { username: 'Allan', avatar_url: null }
    const insertSingle = vi.fn().mockResolvedValue({ data: insertedProfile, error: null })
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
    const insert = vi.fn().mockReturnValue({ select: insertSelect })

    vi.spyOn(supabase, 'from')
      .mockReturnValueOnce({ update, upsert } as never)
      .mockReturnValueOnce({ insert } as never)

    const result = await createSupabaseAuthGateway().saveProfile(SESSION, 'Allan', null)

    expect(update).toHaveBeenCalledWith({
      username: 'Allan',
      email: 'allan@example.com',
      avatar_url: null,
    })
    expect(updateEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      username: 'Allan',
      email: 'allan@example.com',
      avatar_url: null,
    })
    expect(result).toEqual({ username: 'Allan', avatarUrl: null })
  })
})
