import type { ReactNode } from "react";

// Unescape backslash-escaped markdown punctuation (e.g. "new\_lead" → "new_lead").
function unescape(s: string): string {
  return s.replace(/\\([\\`*_#~[\]()>+-])/g, "$1");
}

// Inline formatting: **bold**, `code`, *italic*, _italic_, [text](url).
function renderInline(text: string, kp: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`(.+?)`|\*(.+?)\*|__(.+?)__|\[(.+?)\]\((.+?)\)/g;
  let last = 0, i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(unescape(text.slice(last, m.index)));
    const key = `${kp}-${i++}`;
    if (m[1] != null) nodes.push(<strong key={key} className="font-semibold text-ink">{unescape(m[1])}</strong>);
    else if (m[2] != null) nodes.push(<code key={key} className="px-1.5 py-0.5 rounded-md bg-black/5 text-[0.85em] font-mono text-ink">{m[2]}</code>);
    else if (m[3] != null) nodes.push(<em key={key} className="italic">{unescape(m[3])}</em>);
    else if (m[4] != null) nodes.push(<em key={key} className="italic">{unescape(m[4])}</em>);
    else if (m[5] != null) nodes.push(<a key={key} href={m[6]} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">{unescape(m[5])}</a>);
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(unescape(text.slice(last)));
  return nodes;
}

/** Minimal, safe Markdown → React for assistant replies. Supports headings,
 *  bold/italic/code/links, and bullet/numbered lists. */
export default function MarkdownLite({ text }: { text: string }) {
  const lines = (text || "").replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      const key = `p${blocks.length}`;
      blocks.push(<p key={key} className="text-ink/90">{renderInline(para.join(" "), key)}</p>);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const key = `l${blocks.length}`;
      const cls = list.ordered ? "list-decimal" : "list-disc";
      const items = list.items;
      blocks.push(
        <ul key={key} className={`${cls} pl-5 space-y-1 marker:text-accent`}>
          {items.map((it, idx) => <li key={`${key}-${idx}`}>{renderInline(it, `${key}-${idx}`)}</li>)}
        </ul>,
      );
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const b = line.match(/^\s*[-*•]\s+(.*)$/);
    const o = line.match(/^\s*\d+\.\s+(.*)$/);

    if (h) {
      flushPara(); flushList();
      blocks.push(<p key={`h${blocks.length}`} className="font-semibold text-ink">{renderInline(h[2], `h${blocks.length}`)}</p>);
    } else if (o) {
      flushPara();
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push(o[1]);
    } else if (b) {
      flushPara();
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(b[1]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara(); flushList();

  return <div className="space-y-2 text-sm leading-relaxed">{blocks}</div>;
}
