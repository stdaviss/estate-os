/**
 * The opaque session key the game votes are stored against.
 *
 * Anonymous play is allowed (05-AGENT-C §C5), so this is a random value in `sessionStorage`
 * rather than anything derived from the visitor. It identifies a browser tab for as long as
 * it is open and nothing else: no fingerprint, no cookie shared with other pages, and no
 * link to an account. It exists so one person cannot vote twice on the same pair, which is
 * the only thing it is used for.
 */

const STORAGE_KEY = 'which-mix-session'

export function getSessionKey(): string {
  const existing = window.sessionStorage.getItem(STORAGE_KEY)
  if (existing && /^[A-Za-z0-9_-]{16,128}$/.test(existing)) return existing

  const bytes = new Uint8Array(24)
  window.crypto.getRandomValues(bytes)
  const key = base64Url(bytes)
  window.sessionStorage.setItem(STORAGE_KEY, key)
  return key
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
