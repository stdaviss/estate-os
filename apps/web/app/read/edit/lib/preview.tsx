/**
 * The editor's live preview.
 *
 * A deliberately small Markdown subset — headings, paragraphs, lists, quotes, rules, links,
 * bold and inline code — rendered with the same classes as `PostBody` so type, measure and
 * colour match the published page.
 *
 * Why a subset rather than the real MDX compiler: `PostBody` is a server component, and
 * compiling MDX in the browser means shipping the compiler to it. The trade is recorded in
 * SUBMISSION.md §9 — a writer embedding a custom JSX component sees the source line rather
 * than the component, which is wrong but visible, and preferable to a preview that silently
 * renders differently from the page.
 *
 * Nothing here interprets raw HTML: input is treated as text, so a paste from a web page
 * cannot inject markup into the preview.
 */

import type { ReactNode } from 'react'

export function renderPreview(source: string): ReactNode {
  if (source.trim().length === 0) {
    return (
      <p className="font-body text-body-s text-chalk-mute">
        Nothing to preview yet. Start typing on the left.
      </p>
    )
  }

  const blocks = source.replace(/\r\n/g, '\n').split(/\n{2,}/)

  return (
    <div>
      {blocks.map((block, index) => (
        <Block key={index} source={block.trim()} />
      ))}
    </div>
  )
}

function Block({ source }: { source: string }) {
  if (source.length === 0) return null

  if (/^---+$/.test(source)) {
    return <hr className="my-8 border-0 border-t border-rule" />
  }

  const heading = /^(#{2,3})\s+(.*)$/.exec(source)
  if (heading) {
    const text = inline(heading[2])
    return heading[1].length === 2 ? (
      <h2 className="mt-8 font-display text-display-m uppercase text-chalk">{text}</h2>
    ) : (
      <h3 className="mt-6 font-display text-display-m uppercase text-chalk-dim">{text}</h3>
    )
  }

  if (source.startsWith('> ')) {
    return (
      <blockquote className="mt-6 max-w-measure border-l-2 border-rule-lit pl-4 font-body text-body-l text-chalk-dim">
        {inline(source.replace(/^>\s?/gm, ''))}
      </blockquote>
    )
  }

  const lines = source.split('\n')

  if (lines.every((line) => /^[-*]\s+/.test(line))) {
    return (
      <ul className="mt-4 max-w-measure list-disc pl-6 font-body text-body-l text-chalk">
        {lines.map((line, index) => (
          <li key={index} className="mt-2">
            {inline(line.replace(/^[-*]\s+/, ''))}
          </li>
        ))}
      </ul>
    )
  }

  if (lines.every((line) => /^\d+\.\s+/.test(line))) {
    return (
      <ol className="mt-4 max-w-measure list-decimal pl-6 font-body text-body-l text-chalk">
        {lines.map((line, index) => (
          <li key={index} className="mt-2">
            {inline(line.replace(/^\d+\.\s+/, ''))}
          </li>
        ))}
      </ol>
    )
  }

  // An MDX component or an import: shown as source, because this preview cannot run it.
  if (/^(import\s|export\s|<[A-Z])/.test(source)) {
    return (
      <p className="mt-4 max-w-measure rounded border border-rule bg-hull px-3 py-2 font-data text-data text-chalk-mute">
        {source}
      </p>
    )
  }

  return <p className="mt-4 max-w-measure font-body text-body-l text-chalk">{inline(source)}</p>
}

/** Bold, inline code and links. Everything else is literal text. */
function inline(source: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g
  const nodes: ReactNode[] = []
  let cursor = 0
  let match = pattern.exec(source)
  let key = 0

  while (match) {
    if (match.index > cursor) nodes.push(source.slice(cursor, match.index))
    const token = match[0]

    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-medium text-chalk">
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="font-data text-data text-chalk-dim">
          {token.slice(1, -1)}
        </code>,
      )
    } else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)
      if (link) {
        nodes.push(
          <a
            key={key}
            href={safeHref(link[2])}
            className="rounded text-brine underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-sodium"
          >
            {link[1]}
          </a>,
        )
      } else {
        nodes.push(token)
      }
    }

    key += 1
    cursor = match.index + token.length
    match = pattern.exec(source)
  }

  if (cursor < source.length) nodes.push(source.slice(cursor))
  return nodes
}

/** Blocks `javascript:` and other executable schemes in a pasted link. */
function safeHref(href: string): string {
  if (/^(https?:|mailto:|\/|#)/i.test(href)) return href
  return '#'
}
