import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseFrontmatter } from './fixtures.ts';
import { parseInline, parseMarkdown } from './mdx.ts';
import { GET } from './index.ts';

describe('posts', () => {
  it('lists published posts and filters by tag', async () => {
    const all = await GET(new Request('http://local/api/v1/posts'));
    const allBody = (await all.json()) as { data: { slug: string }[] };
    assert.equal(allBody.data.length, 8);

    const tagged = await GET(new Request('http://local/api/v1/posts?tag=interview'));
    const taggedBody = (await tagged.json()) as { data: { tags: string[] }[] };
    assert.ok(taggedBody.data.length >= 3);
    assert.ok(taggedBody.data.every((p) => p.tags.includes('interview')));
  });

  it('returns a post by slug without frontmatter fences', async () => {
    const res = await GET(new Request('http://local/api/v1/posts/nour-el-kasbah-in-tunis'));
    const body = (await res.json()) as { data: { title: string; body_mdx: string; related_artist_ids: string[] } };
    assert.match(body.data.title, /Nour El-Kasbah/);
    assert.equal(body.data.body_mdx.startsWith('---'), false);
    assert.ok(body.data.related_artist_ids.length > 0);
  });

  it('parses markdown headings and bold', () => {
    const blocks = parseMarkdown('## The room\n\nShe does not call it a **studio**.');
    assert.equal(blocks[0]?.t, 'h2');
    const inline = parseInline('She does not call it a **studio**.');
    assert.ok(inline.some((t) => t.t === 'strong' && t.value === 'studio'));
  });

  it('reads tags from frontmatter', () => {
    const { tags, body } = parseFrontmatter('---\ntags: [interview, tunis]\n---\n\nHello');
    assert.deepEqual(tags, ['interview', 'tunis']);
    assert.equal(body.trim(), 'Hello');
  });
});
