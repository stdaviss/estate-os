/**
 * MDX rendering for editorial.
 *
 * One renderer, used by both the published page and the editor preview, so the two cannot
 * disagree about how a piece will look.
 *
 * `next-mdx-remote` is not in `apps/web/package.json` and Agent C does not own that file
 * (BLOCKER 9), so this import does not resolve yet. The component map below is the part
 * worth reviewing: it is where the design system's reading measure and type scale are
 * applied, and it holds regardless of which MDX runtime ends up being used.
 */

import type { ReactNode } from 'react'

import { MDXRemote } from 'next-mdx-remote/rsc'

import { Rule } from '@repo/ui'

/**
 * Element mapping for editorial prose.
 *
 * `body-l` at a ~68 character measure, per 05-AGENT-C §C4. Links in body copy are the one
 * place brine appears (01-DESIGN-SYSTEM.md §2), and no sodium is used in prose at all.
 */
const components = {
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mt-8 font-display text-display-m uppercase text-chalk">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-6 font-display text-display-m uppercase text-chalk-dim">{children}</h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mt-4 max-w-measure font-body text-body-l text-chalk">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mt-4 max-w-measure list-disc pl-6 font-body text-body-l text-chalk">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mt-4 max-w-measure list-decimal pl-6 font-body text-body-l text-chalk">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li className="mt-2">{children}</li>,
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      className="rounded text-brine underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-sodium"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="mt-6 max-w-measure border-l-2 border-rule-lit pl-4 font-body text-body-l text-chalk-dim">
      {children}
    </blockquote>
  ),
  hr: () => <Rule className="my-8" />,
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-medium text-chalk">{children}</strong>
  ),
  code: ({ children }: { children?: ReactNode }) => (
    <code className="font-data text-data text-chalk-dim">{children}</code>
  ),
}

export function PostBody({ source }: { source: string }) {
  return <MDXRemote source={source} components={components} />
}
