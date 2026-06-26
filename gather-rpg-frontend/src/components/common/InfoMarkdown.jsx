import React from 'react';

// Renderer de markdown MÍNIMO y seguro (sin dependencias ni dangerouslySetInnerHTML) para
// los letreros de información. Soporta: encabezados (#/##/###), negrita (**), cursiva (*) e
// imágenes ![alt](url). Pensado para contenido de juego sencillo: texto / imagen / texto.

const IMG_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
const EMPH_RE = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;

// Negrita/cursiva sobre un trozo de texto plano.
function renderEmphasis(text, keyPrefix) {
  const out = [];
  let last = 0, m, i = 0;
  EMPH_RE.lastIndex = 0;
  while ((m = EMPH_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] !== undefined) out.push(<strong key={`${keyPrefix}-b${i}`}>{m[2]}</strong>);
    else out.push(<em key={`${keyPrefix}-i${i}`}>{m[3]}</em>);
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Imágenes intercaladas + énfasis en los trozos de texto.
function renderInline(text, keyPrefix) {
  const nodes = [];
  let last = 0, m, i = 0;
  IMG_RE.lastIndex = 0;
  while ((m = IMG_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(...renderEmphasis(text.slice(last, m.index), `${keyPrefix}-t${i}`));
    const alt = m[1] || '';
    const url = m[2];
    nodes.push(
      <img
        key={`${keyPrefix}-img${i}`}
        src={url}
        alt={alt}
        loading="lazy"
        style={{ maxWidth: '100%', borderRadius: 8, display: 'block', margin: '10px auto' }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    );
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) nodes.push(...renderEmphasis(text.slice(last), `${keyPrefix}-t${i}`));
  return nodes;
}

export function InfoMarkdown({ content, className }) {
  const lines = (content || '').replace(/\r\n/g, '\n').split('\n');
  return (
    <div className={className}>
      {lines.map((ln, idx) => {
        const t = ln.trim();
        if (t === '') return <div key={idx} style={{ height: 8 }} />;
        const h = t.match(/^(#{1,3})\s+(.*)$/);
        if (h) {
          const level = h[1].length;
          const Tag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
          return <Tag key={idx} style={{ fontWeight: 800, margin: '8px 0 4px' }}>{renderInline(h[2], `h${idx}`)}</Tag>;
        }
        return <p key={idx} style={{ margin: '4px 0', lineHeight: 1.5 }}>{renderInline(t, `l${idx}`)}</p>;
      })}
    </div>
  );
}

export default InfoMarkdown;
