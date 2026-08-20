import { GET } from '../../../../api/posts/index';
import { artists } from '../../../../api/schedule/fixtures';
import { parseInline, parseMarkdown } from '../../../../api/posts/mdx';
import { EmptyState } from '../../schedule/_lib/ui';
import { WhatsOnNow } from '../../schedule/_lib/whats-on-now';

export const metadata = { title: 'Read' };

type Post = {
  slug: string;
  title: string;
  standfirst: string;
  body_mdx: string;
  author_name: string;
  published_at: string | null;
  related_artist_ids: string[];
  tags: string[];
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }> | { slug: string };
  searchParams?: Promise<{ empty?: string }>;
}) {
  const { slug } = await Promise.resolve(params);
  const sp = searchParams ? await searchParams : {};
  if (sp.empty === '1' || process.env.EMPTY === '1') {
    return (
      <main className="c-page">
        <EmptyState label="Read">Nothing filed yet. The first piece goes up with the first broadcast.</EmptyState>
      </main>
    );
  }
  const res = await GET(new Request(`http://local/api/v1/posts/${slug}`));
  if (!res.ok) {
    return (
      <main className="c-page">
        <EmptyState label="No match">Nothing here for that. Try a genre, a city, or an artist name.</EmptyState>
      </main>
    );
  }
  const body = (await res.json()) as { data: Post };
  const post = body.data;
  const related = artists.filter((a) => post.related_artist_ids.includes(a.id));
  const blocks = parseMarkdown(post.body_mdx);

  return (
    <main className="c-page">
      <div className="c-read-layout">
        <article className="c-measure">
          <span className="c-label">{post.tags.join(' · ')}</span>
          <h1 className="c-display-l" style={{ margin: '12px 0' }}>
            {post.title}
          </h1>
          <p className="c-body-l" style={{ color: 'var(--chalk-dim)', marginBottom: 32 }}>
            {post.standfirst}
          </p>
          <div className="c-mdx">
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
                  {parseInline(block.text).map((tok, j) => {
                    if (tok.t === 'strong') return <strong key={j}>{tok.value}</strong>;
                    if (tok.t === 'link') {
                      return (
                        <a key={j} className="body-link" href={tok.href}>
                          {tok.value}
                        </a>
                      );
                    }
                    return <span key={j}>{tok.value}</span>;
                  })}
                </p>
              );
            })}
          </div>
          <p className="c-body-s">{post.author_name}</p>
        </article>
        <aside>
          <WhatsOnNow compact />
          {related.length > 0 && (
            <div>
              <h2 className="c-label" style={{ margin: '24px 0 8px' }}>
                Related
              </h2>
              <div className="c-related">
                {related.map((a) => (
                  <a key={a.id} href={`/artists/${a.slug}`}>
                    <span className="c-display-m" style={{ fontSize: 14, lineHeight: '20px' }}>
                      {a.name}
                    </span>
                    <span className="c-body-s">
                      {a.city} · {a.relationship}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
