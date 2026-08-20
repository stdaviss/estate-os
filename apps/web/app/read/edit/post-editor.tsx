'use client'

/**
 * The editor form.
 *
 * The preview is debounced and rendered from the MDX source on every pause in typing. It
 * runs through `PostBody`, the same component map the published page uses.
 *
 * Note the preview limitation recorded in SUBMISSION.md §9: `PostBody` is a server
 * component, so it cannot be rendered from here directly. The preview therefore shows the
 * structure of the piece with the design system's type applied, and headings, paragraphs,
 * quotes, lists and links resolved — but not arbitrary JSX components embedded in the MDX.
 * A writer using a custom component sees it as source, which is honest but not what §C4
 * asks for.
 */

import { useEffect, useMemo, useState } from 'react'

import { Button, Field, Rule, Toggle } from '@repo/ui'

import { postJson } from './lib/save'
import { renderPreview } from './lib/preview'

export interface PostEditorProps {
  authorName: string | null
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; publish: boolean }
  | { kind: 'error'; message: string; field?: string }

export function PostEditor({ authorName }: PostEditorProps) {
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [standfirst, setStandfirst] = useState('')
  const [body, setBody] = useState('')
  const [relatedArtists, setRelatedArtists] = useState('')
  const [publish, setPublish] = useState(false)
  const [state, setState] = useState<SaveState>({ kind: 'idle' })

  const [debouncedBody, setDebouncedBody] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedBody(body), 250)
    return () => window.clearTimeout(timer)
  }, [body])

  const preview = useMemo(() => renderPreview(debouncedBody), [debouncedBody])

  async function save() {
    setState({ kind: 'saving' })
    const result = await postJson({
      slug: slug.trim(),
      title: title.trim(),
      standfirst: standfirst.trim() || null,
      body_mdx: body,
      author_name: authorName,
      related_artists: relatedArtists
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
      publish,
    })

    if (result.ok) {
      setState({ kind: 'saved', publish })
      return
    }
    setState({ kind: 'error', message: result.error.message, field: result.error.field })
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <Field
          label="Title"
          value={title}
          onChange={setTitle}
          required
          error={state.kind === 'error' && state.field === 'title' ? state.message : undefined}
        />

        <Field
          label="Address"
          hint="Lower case, hyphens. This becomes /read/…"
          value={slug}
          onChange={setSlug}
          required
          error={state.kind === 'error' && state.field === 'slug' ? state.message : undefined}
        />

        <Field label="Standfirst" hint="One or two lines under the title." value={standfirst} onChange={setStandfirst} />

        <Field
          label="Artists in this piece"
          hint="Slugs, comma separated. They do not have to be ours."
          value={relatedArtists}
          onChange={setRelatedArtists}
          error={
            state.kind === 'error' && state.field === 'related_artists' ? state.message : undefined
          }
        />

        <div>
          <label
            htmlFor="body-mdx"
            className="block font-data text-label uppercase tracking-label text-chalk-dim"
          >
            Body (MDX)
          </label>
          <textarea
            id="body-mdx"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={24}
            spellCheck
            required
            aria-describedby="body-mdx-hint"
            className="mt-2 w-full rounded border border-rule bg-hull px-3 py-2 font-data text-data text-chalk outline-none focus-visible:border-sodium focus-visible:ring-2 focus-visible:ring-sodium"
          />
          <p id="body-mdx-hint" className="mt-1 font-body text-body-s text-chalk-mute">
            Markdown with components. Headings start at level two.
          </p>
          {state.kind === 'error' && state.field === 'body_mdx' ? (
            <p role="alert" className="mt-1 font-body text-body-s text-chalk">
              {state.message}
            </p>
          ) : null}
        </div>

        <Rule />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Toggle
            label="Publish"
            hint="Off keeps it a draft, visible to staff only."
            checked={publish}
            onChange={setPublish}
          />

          <div className="flex items-center gap-3">
            <Button variant="primary" type="submit" disabled={state.kind === 'saving'}>
              <span className="font-data text-label uppercase tracking-label">
                {state.kind === 'saving' ? 'saving…' : publish ? 'publish' : 'save draft'}
              </span>
            </Button>
            {slug.trim().length > 0 ? (
              <Button variant="ghost" href={`/read/${slug.trim()}`}>
                <span className="font-data text-label uppercase tracking-label">view</span>
              </Button>
            ) : null}
          </div>
        </div>

        {state.kind === 'saved' ? (
          <p role="status" className="font-body text-body-s text-chalk-dim">
            {state.publish ? 'Published.' : 'Saved as a draft.'}
          </p>
        ) : null}

        {state.kind === 'error' && !state.field ? (
          <p role="alert" className="font-body text-body-s text-chalk">
            {state.message}
          </p>
        ) : null}
      </form>

      <section aria-label="Preview" className="border-l border-rule pl-0 lg:pl-8">
        <p className="font-data text-label uppercase tracking-label text-chalk-mute">preview</p>
        <h2 className="mt-3 max-w-measure font-display text-display-l uppercase text-chalk">
          {title || 'Untitled'}
        </h2>
        {standfirst ? (
          <p className="mt-3 max-w-measure font-body text-body-l text-chalk-dim">{standfirst}</p>
        ) : null}
        <Rule className="my-6" />
        {preview}
      </section>
    </div>
  )
}
