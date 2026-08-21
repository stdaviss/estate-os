/**
 * Saving a post from the editor.
 *
 * Posts to the staff write endpoint, which checks the role again server-side. Returns the
 * failure as a value so the form can show it against the right field rather than throwing.
 */

export interface SaveBody {
  slug: string
  title: string
  standfirst: string | null
  body_mdx: string
  author_name: string | null
  related_artists: string[]
  publish: boolean
}

export type SaveResult =
  | { ok: true }
  | { ok: false; error: { code: string; message: string; field?: string } }

export async function postJson(body: SaveBody): Promise<SaveResult> {
  try {
    const response = await fetch('/api/v1/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (response.ok) return { ok: true }

    const payload: unknown = await response.json().catch(() => null)
    if (payload && typeof payload === 'object' && 'error' in payload) {
      return { ok: false, error: (payload as { error: { code: string; message: string; field?: string } }).error }
    }
    return { ok: false, error: { code: 'internal', message: 'The piece did not save. Try again.' } }
  } catch {
    return {
      ok: false,
      error: { code: 'unreachable', message: 'No connection. Your text is still here — try again.' },
    }
  }
}
