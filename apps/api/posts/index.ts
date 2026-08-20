/** GET /api/v1/posts and GET /api/v1/posts/:slug. Staff POST/PATCH is a contract extension. */

import { jsonError, jsonOk, paginateIds, readCursor } from '../schedule/http';
import { isEmptyMode } from '../schedule/fixtures';
import { parseFrontmatter, posts, type PostRecord } from './fixtures';

const extra: PostRecord[] = [];

function allPosts(): PostRecord[] {
  return [...extra, ...posts].sort((a, b) => {
    const at = a.published_at ? new Date(a.published_at).getTime() : 0;
    const bt = b.published_at ? new Date(b.published_at).getTime() : 0;
    return bt - at;
  });
}

function publicPost(row: PostRecord) {
  const { tags, body } = parseFrontmatter(row.body_mdx);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    standfirst: row.standfirst,
    body_mdx: body,
    author_name: row.author_name,
    hero_url: row.hero_url,
    published_at: row.published_at,
    related_artist_ids: row.related_artist_ids,
    tags: tags.length > 0 ? tags : row.tags,
  };
}

function isStaff(request: Request): boolean {
  const role = request.headers.get('x-role');
  return role === 'staff' || role === 'admin';
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (isEmptyMode(process.env, url)) {
    const last = url.pathname.split('/').filter(Boolean).at(-1);
    if (last && last !== 'posts') return jsonError(404, 'not_found', 'No post with that slug.');
    return jsonOk([], { next_cursor: null });
  }

  const pathParts = url.pathname.split('/').filter(Boolean);
  const last = pathParts[pathParts.length - 1] ?? '';
  const slug = last && last !== 'posts' ? last : '';

  if (slug) {
    const row = allPosts().find((p) => p.slug === slug);
    if (!row || !row.published_at) {
      return jsonError(404, 'not_found', 'No post with that slug.');
    }
    return jsonOk(publicPost(row));
  }

  const tag = url.searchParams.get('tag');
  const published = allPosts().filter((p) => p.published_at);
  const filtered = tag
    ? published.filter((p) => {
        const parsed = publicPost(p);
        return parsed.tags.includes(tag);
      })
    : published;
  const { cursor, limit } = readCursor(url);
  const { slice, next_cursor } = paginateIds(filtered, cursor, limit);
  return jsonOk(slice.map(publicPost), { next_cursor });
}

export async function POST(request: Request): Promise<Response> {
  if (!isStaff(request)) {
    return jsonError(403, 'forbidden', 'Staff only.');
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_json', 'Body must be JSON.');
  }
  if (typeof body !== 'object' || body === null) {
    return jsonError(400, 'invalid_json', 'Body must be an object.');
  }
  const rec = body as Record<string, unknown>;
  const title = typeof rec.title === 'string' ? rec.title.trim() : '';
  const slug = typeof rec.slug === 'string' ? rec.slug.trim() : '';
  const body_mdx = typeof rec.body_mdx === 'string' ? rec.body_mdx : '';
  if (!title || !slug || !body_mdx) {
    return jsonError(400, 'invalid', 'title, slug and body_mdx are required.');
  }
  if (allPosts().some((p) => p.slug === slug)) {
    return jsonError(409, 'conflict', 'That slug is already used.', 'slug');
  }
  const published = rec.published === true;
  const row: PostRecord = {
    id: `post-${slug}`,
    slug,
    title,
    standfirst: typeof rec.standfirst === 'string' ? rec.standfirst : '',
    body_mdx,
    author_name: typeof rec.author_name === 'string' ? rec.author_name : 'Staff',
    hero_url: typeof rec.hero_url === 'string' ? rec.hero_url : null,
    published_at: published ? new Date().toISOString() : null,
    related_artist_ids: Array.isArray(rec.related_artist_ids)
      ? rec.related_artist_ids.filter((x): x is string => typeof x === 'string')
      : [],
    tags: Array.isArray(rec.tags) ? rec.tags.filter((x): x is string => typeof x === 'string') : [],
  };
  extra.unshift(row);
  return jsonOk(publicPost(row));
}

export async function PATCH(request: Request): Promise<Response> {
  if (!isStaff(request)) {
    return jsonError(403, 'forbidden', 'Staff only.');
  }
  const url = new URL(request.url);
  const slug = url.pathname.split('/').filter(Boolean).at(-1);
  if (!slug || slug === 'posts') {
    return jsonError(400, 'invalid', 'Pass a slug.');
  }
  const row = extra.find((p) => p.slug === slug) ?? posts.find((p) => p.slug === slug);
  if (!row) return jsonError(404, 'not_found', 'No post with that slug.');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_json', 'Body must be JSON.');
  }
  if (typeof body !== 'object' || body === null) {
    return jsonError(400, 'invalid_json', 'Body must be an object.');
  }
  const rec = body as Record<string, unknown>;
  if (typeof rec.title === 'string') row.title = rec.title;
  if (typeof rec.standfirst === 'string') row.standfirst = rec.standfirst;
  if (typeof rec.body_mdx === 'string') row.body_mdx = rec.body_mdx;
  if (typeof rec.author_name === 'string') row.author_name = rec.author_name;
  if (rec.published === true && !row.published_at) row.published_at = new Date().toISOString();
  if (rec.published === false) row.published_at = null;
  return jsonOk(publicPost(row));
}
