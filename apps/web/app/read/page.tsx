import { GET } from '../../../api/posts/index';
import { Button, EmptyState } from '../schedule/_lib/ui';

export const metadata = { title: 'Read' };

type PostListItem = {
  slug: string;
  title: string;
  standfirst: string;
  published_at: string | null;
  tags: string[];
};

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ empty?: string; tag?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const url = new URL('http://local/api/v1/posts');
  if (sp.empty) url.searchParams.set('empty', sp.empty);
  if (sp.tag) url.searchParams.set('tag', sp.tag);
  const res = await GET(new Request(url.toString()));
  const body = (await res.json()) as { data: PostListItem[] };
  const posts = body.data ?? [];

  if (posts.length === 0) {
    return (
      <main className="c-page">
        <header className="c-page-head">
          <h1 className="c-display-l">Read</h1>
        </header>
        <EmptyState label="Read">
          Nothing filed yet. The first piece goes up with the first broadcast.
        </EmptyState>
      </main>
    );
  }

  return (
    <main className="c-page">
      <header className="c-page-head">
        <h1 className="c-display-l">Read</h1>
        <Button href="/read/editor">Editor</Button>
      </header>
      <ul className="c-list-plain">
        {posts.map((post) => (
          <li key={post.slug}>
            <a className="c-post" href={`/read/${post.slug}`}>
              <span className="c-label">{post.tags.join(' · ') || 'Note'}</span>
              <span className="c-display-m">{post.title}</span>
              <span className="c-body-s">{post.standfirst}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
