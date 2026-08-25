export type InitialAuthMode = 'login' | 'register'

export interface DesktopHandoff {
  callbackUrl: string
  state: string
  initialMode: InitialAuthMode
}

const MIN_DYNAMIC_PORT = 1024
const MAX_PORT = 65_535
const STATE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/

export function parseDesktopHandoff(params: URLSearchParams): DesktopHandoff | null {
  const portText = params.get('desktop_port') ?? ''
  const state = params.get('state') ?? ''
  if (!/^\d+$/.test(portText) || !STATE_PATTERN.test(state)) return null

  const port = Number(portText)
  if (!Number.isInteger(port) || port < MIN_DYNAMIC_PORT || port > MAX_PORT) return null

  return {
    callbackUrl: `http://127.0.0.1:${port}/auth/callback`,
    state,
    initialMode: params.get('mode') === 'register' ? 'register' : 'login',
  }
}

export interface DesktopSessionPayload {
  accessToken: string
  refreshToken: string
}

export function submitDesktopSession(
  handoff: DesktopHandoff,
  payload: DesktopSessionPayload,
): void {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = handoff.callbackUrl

  const values = {
    state: handoff.state,
    access_token: payload.accessToken,
    refresh_token: payload.refreshToken,
  }
  Object.entries(values).forEach(([name, value]) => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.append(input)
  })

  document.body.append(form)
  form.submit()
}
