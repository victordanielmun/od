import React, { useState, useRef, useEffect } from 'react';
import api from '../../services/api';
import { InfoMarkdown } from '../common/InfoMarkdown';

// Mini-editor de letreros de info: textarea Markdown + subir/insertar arte + vista previa.
// El arte se sube al backend (uploads/info) y se referencia como ![](/api/info-art/<file>).
export function InfoSignEditor({ value, onChange }) {
  const [arts, setArts] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const taRef = useRef(null);
  const fileRef = useRef(null);

  const loadArts = async () => {
    try { const r = await api.get('/admin/info-art'); setArts(r.data || []); } catch { /* vacío */ }
  };
  useEffect(() => { loadArts(); }, []);

  const insertAtCursor = (snippet) => {
    const ta = taRef.current;
    const v = value || '';
    if (ta && typeof ta.selectionStart === 'number') {
      const s = ta.selectionStart, e = ta.selectionEnd;
      onChange(v.slice(0, s) + snippet + v.slice(e));
    } else {
      onChange(v + snippet);
    }
  };

  const insertImage = (art) => {
    insertAtCursor(`\n![${art.filename}](${art.url})\n`);
    setShowPicker(false);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/admin/info-art', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await loadArts();
      if (r.data?.url) insertImage({ filename: r.data.filename, url: r.data.url });
    } catch (err) {
      console.error('[InfoSignEditor] upload failed', err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="mb-2">
      <label className="block text-[9px] text-gray-500 mb-0.5">
        Contenido del letrero (Markdown: <code>**negrita**</code> · <code># título</code> · <code>![](imagen)</code>)
      </label>
      <textarea
        ref={taRef}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder="Escribe el mensaje... usa 'Insertar arte' para añadir imágenes"
        rows={5}
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none resize-none font-sans"
      />
      <div className="flex flex-wrap gap-1 mt-1">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="px-2 py-1 text-[9px] bg-blue-600/30 border border-blue-500/40 rounded text-blue-200 hover:bg-blue-600/50 disabled:opacity-50">
          {uploading ? 'Subiendo…' : '⬆ Subir imagen'}
        </button>
        <button type="button" onClick={() => { setShowPicker(p => !p); loadArts(); }}
          className="px-2 py-1 text-[9px] bg-gray-700 border border-gray-600 rounded text-gray-200 hover:bg-gray-600">
          🖼 Insertar arte ({arts.length})
        </button>
        <button type="button" onClick={() => setShowPreview(p => !p)}
          className="px-2 py-1 text-[9px] bg-gray-700 border border-gray-600 rounded text-gray-200 hover:bg-gray-600">
          {showPreview ? 'Ocultar preview' : 'Vista previa'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleUpload} />
      </div>

      {showPicker && (
        <div className="mt-1 grid grid-cols-4 gap-1 bg-gray-900/60 border border-gray-700 rounded p-1 max-h-32 overflow-y-auto">
          {arts.length === 0 && (
            <div className="col-span-4 text-[9px] text-gray-500 p-2 text-center">Sin arte aún — sube una imagen.</div>
          )}
          {arts.map(a => (
            <button key={a.filename} type="button" onClick={() => insertImage(a)} title={a.filename}
              className="aspect-square bg-gray-800 border border-gray-700 rounded overflow-hidden hover:border-yellow-400">
              <img src={a.url} alt={a.filename} className="w-full h-full object-contain" />
            </button>
          ))}
        </div>
      )}

      {showPreview && (
        <div className="mt-1 bg-gray-950 border border-gray-700 rounded p-2 text-[10px] text-gray-200 max-h-40 overflow-y-auto">
          <InfoMarkdown content={value} />
        </div>
      )}
    </div>
  );
}

export default InfoSignEditor;
