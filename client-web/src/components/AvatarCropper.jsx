import { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

const VIEW = 280;   // on-screen crop area, px
const OUTPUT = 512; // saved avatar size, px

/**
 * Crop a new profile picture to the circle it's shown in: drag to position,
 * zoom with the slider. `onSave` gets a square JPEG blob (the circle is applied
 * when it's displayed).
 */
export default function AvatarCropper({ src, onCancel, onSave, saving }) {
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef(null);

  useEffect(() => {
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = src;
  }, [src]);

  // The image always covers the crop area; zoom 1 = just covering it.
  const base = img ? Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight) : 1;
  const scale = base * zoom;
  const w = img ? img.naturalWidth * scale : VIEW;
  const h = img ? img.naturalHeight * scale : VIEW;
  const clamp = ({ x, y }) => ({
    x: Math.max(-(w - VIEW) / 2, Math.min((w - VIEW) / 2, x)),
    y: Math.max(-(h - VIEW) / 2, Math.min((h - VIEW) / 2, y)),
  });
  useEffect(() => { setOffset((o) => clamp(o)); }, [zoom, img]); // keep it covered after zooming out

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, from: offset };
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const { startX, startY, from } = drag.current;
    setOffset(clamp({ x: from.x + e.clientX - startX, y: from.y + e.clientY - startY }));
  };
  const onPointerUp = () => { drag.current = null; };

  const left = VIEW / 2 - w / 2 + offset.x;
  const top = VIEW / 2 - h / 2 + offset.y;

  const save = () => {
    if (!img) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    // The crop area in the image's own pixels.
    canvas.getContext('2d').drawImage(img, -left / scale, -top / scale, VIEW / scale, VIEW / scale, 0, 0, OUTPUT, OUTPUT);
    canvas.toBlob((blob) => blob && onSave(blob), 'image/jpeg', 0.9);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-5 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Profile picture</h3>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="relative mx-auto overflow-hidden rounded-xl bg-gray-900 touch-none cursor-grab active:cursor-grabbing select-none"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          {img && <img src={src} alt="" draggable={false} className="absolute max-w-none pointer-events-none" style={{ left, top, width: w, height: h }} />}
          {/* Everything outside the circle is dimmed: that's what the avatar shows. */}
          <div className="absolute inset-0 rounded-full pointer-events-none ring-2 ring-white/80" style={{ boxShadow: '0 0 0 999px rgba(0,0,0,0.55)' }} />
        </div>

        <div className="flex items-center gap-3">
          <ZoomOut size={16} className="text-gray-400 shrink-0" />
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-brand-600" aria-label="Zoom" />
          <ZoomIn size={16} className="text-gray-400 shrink-0" />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">Drag to position, zoom to fit. Only the circle is shown.</p>

        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={save} disabled={!img || saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
