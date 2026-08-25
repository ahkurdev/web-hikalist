import type { AuthSession } from './authGateway'
import { supabase } from './supabase'

export interface PlaylistInviteAcceptance {
  playlistId: string
  playlistName: string
}

export interface PlaylistInviteGateway {
  accept(token: string, session: AuthSession): Promise<PlaylistInviteAcceptance>
}

const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/

export function parsePlaylistInviteToken(params: URLSearchParams): string | null {
  const token = params.get('token')?.trim() ?? ''
  return INVITE_TOKEN_PATTERN.test(token) ? token : null
}

export const supabasePlaylistInviteGateway: PlaylistInviteGateway = {
  async accept(token) {
    const { data, error } = await supabase.rpc('accept_hika_playlist_invite', { p_token: token })
    if (error) throw error
    const row = (Array.isArray(data) ? data[0] : data) as {
      playlist_id?: string
      playlist_name?: string
    } | null
    if (!row?.playlist_id || !row.playlist_name) {
      throw new Error('Invite link is invalid or has expired')
    }
    return { playlistId: row.playlist_id, playlistName: row.playlist_name }
  },
}
