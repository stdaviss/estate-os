/** Minimal markdown renderer for editorial preview. No raw HTML. */

export type Block =
  | { t: 'h2'; text: string }
  | { t: 'p'; text: string }
  | { t: 'ul'; items: string[] };

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    blocks.push({ t: 'p', text: para.join(' ') });
    para = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    blocks.push({ t: 'ul', items: [...list] });
    list = [];
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flushPara();
      flushList();
      blocks.push({ t: 'h2', text: line.slice(3) });
      continue;
    }
    if (line.startsWith('- ')) {
      flushPara();
      list.push(line.slice(2));
      continue;
    }
    if (line.trim() === '') {
      flushPara();
      flushList();
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return blocks;
}

/** Inline markup: **bold** and [text](href). Returns a safe token list. */
export type Inline =
  | { t: 'text'; value: string }
  | { t: 'strong'; value: string }
  | { t: 'link'; value: string; href: string };

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:[^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null = re.exec(text);
  while (m) {
    if (m.index > last) out.push({ t: 'text', value: text.slice(last, m.index) });
    if (m[1]) out.push({ t: 'strong', value: m[1] });
    else if (m[2] && m[3]) out.push({ t: 'link', value: m[2], href: m[3] });
    last = m.index + m[0].length;
    m = re.exec(text);
  }
  if (last < text.length) out.push({ t: 'text', value: text.slice(last) });
  return out;
}
