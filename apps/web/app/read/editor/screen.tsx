'use client';

import { useState } from 'react';
import { Button, Field, Toggle } from '../../schedule/_lib/ui';
import { parseMarkdown, parseInline } from '../../../../api/posts/mdx';

export function EditorScreen() {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [standfirst, setStandfirst] = useState('');
  const [body, setBody] = useState('## Title\n\nWrite in MDX. Related artists we do not represent belong here too.');
  const [published, setPublished] = useState(false);
  const [related, setRelated] = useState('');
  const [status, setStatus] = useState<'ready' | 'error' | 'saved'>('ready');

  const blocks = parseMarkdown(body);

  async function save() {
    try {
      const res = await fetch('/api/v1/posts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-role': 'staff',
        },
        body: JSON.stringify({
          title,
          slug,
          standfirst,
          body_mdx: body,
          published,
          related_artist_ids: related
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error('save failed');
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <main className="c-page">
      <header className="c-page-head">
        <h1 className="c-display-l">Editor</h1>
        <Button variant="primary" onClick={() => void save()}>
          {published ? 'Publish' : 'Save'}
        </Button>
      </header>
      {status === 'error' && (
        <div className="c-status">
          The post did not save. Confirm you are staff and try again.
          <div className="c-retry">
            <Button variant="primary" onClick={() => void save()}>
              Retry
            </Button>
          </div>
        </div>
      )}
      {status === 'saved' && <p className="c-body-s">Saved.</p>}
      <div className="c-editor">
        <div>
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Slug">
            <input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </Field>
          <Field label="Standfirst">
            <input value={standfirst} onChange={(e) => setStandfirst(e.target.value)} />
          </Field>
          <Field label="Related artist ids">
            <input value={related} onChange={(e) => setRelated(e.target.value)} />
          </Field>
          <Toggle checked={published} onChange={setPublished} label="Published" />
          <Field label="MDX">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        </div>
        <article className="c-measure c-mdx">
          <span className="c-label">Preview</span>
          <h1 className="c-display-l">{title || 'Untitled'}</h1>
          <p className="c-body-l" style={{ color: 'var(--chalk-dim)' }}>
            {standfirst}
          </p>
          {blocks.map((block, i) => {
            if (block.t === 'h2') return <h2 key={i}>{block.text}</h2>;
            if (block.t === 'ul') {
              return (
                <ul key={i}>
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              );
            }
            return (
              <p key={i}>
                {parseInline(block.text).map((tok, j) =>
                  tok.t === 'strong' ? <strong key={j}>{tok.value}</strong> : <span key={j}>{tok.value}</span>,
                )}
              </p>
            );
          })}
        </article>
      </div>
    </main>
  );
}
