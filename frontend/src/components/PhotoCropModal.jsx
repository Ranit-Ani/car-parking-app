import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { ActionButton } from './Bits';
import { cropAndCompress } from '../lib/imageCrop';

// Size (CSS px) of the circular crop viewport shown to the user.
const VIEWPORT = 280;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/**
 * WhatsApp-style "select photo → pan/zoom inside a circle → confirm" crop
 * step. Accepts any source image (any resolution/file size — the caller
 * doesn't need to pre-validate that) and hands back a single compressed,
 * appropriately-sized square JPEG data URL via onDone. Nothing here ever
 * uploads or stores the original image.
 */
export default function PhotoCropModal({ show, imageSrc, onCancel, onDone }) {
  const imgElRef = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  const dragRef = useRef(null);  // { x, y, ox, oy } while a pointer drag is active
  const pinchRef = useRef(null); // { dist, zoom } while a two-finger pinch is active

  // Fresh image -> fresh crop state (fit-to-circle at zoom 1, centered).
  useEffect(() => {
    if (!show) return;
    setImgLoaded(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [show, imageSrc]);

  function handleImgLoad(e) {
    const w = e.target.naturalWidth;
    const h = e.target.naturalHeight;
    setNatural({ w, h });
    // "cover" scale — smallest dimension exactly fills the circle so there's
    // never empty space inside the crop area, same as WhatsApp/most avatar pickers.
    setBaseScale(VIEWPORT / Math.min(w, h));
    setImgLoaded(true);
  }

  function clampOffset(nx, ny, z, nat = natural, bs = baseScale) {
    const dw = nat.w * bs * z;
    const dh = nat.h * bs * z;
    const maxX = Math.max(0, (dw - VIEWPORT) / 2);
    const maxY = Math.max(0, (dh - VIEWPORT) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, nx)), y: Math.min(maxY, Math.max(-maxY, ny)) };
  }

  function changeZoom(z) {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    setZoom(clamped);
    setOffset((o) => clampOffset(o.x, o.y, clamped));
  }

  function onPointerDown(e) {
    if (!imgLoaded) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setOffset(clampOffset(dragRef.current.ox + dx, dragRef.current.oy + dy, zoom));
  }
  function onPointerUp(e) {
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* no-op */ }
  }

  function onWheel(e) {
    if (!imgLoaded) return;
    e.preventDefault();
    changeZoom(zoom - e.deltaY * 0.0015);
  }

  function touchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }
  function onTouchStart(e) {
    if (e.touches.length === 2) {
      dragRef.current = null;
      pinchRef.current = { dist: touchDist(e.touches), zoom };
    }
  }
  function onTouchMove(e) {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const ratio = touchDist(e.touches) / pinchRef.current.dist;
      changeZoom(pinchRef.current.zoom * ratio);
    }
  }
  function onTouchEnd(e) {
    if (e.touches.length < 2) pinchRef.current = null;
  }

  async function handleDone() {
    if (!imgElRef.current || !imgLoaded) return;
    setBusy(true);
    try {
      const dataUrl = await cropAndCompress({
        img: imgElRef.current,
        natural,
        baseScale,
        zoom,
        offset,
        viewport: VIEWPORT,
      });
      onDone(dataUrl);
    } catch {
      onCancel?.();
    } finally {
      setBusy(false);
    }
  }

  const dw = natural.w * baseScale * zoom;
  const dh = natural.h * baseScale * zoom;

  return (
    <Modal show={show} onClose={busy ? undefined : onCancel} title="Adjust Photo" icon="bi-crop" size="sm">
      <div className="photo-crop-wrap">
        <div
          className="photo-crop-viewport"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {imageSrc && (
            <img
              ref={imgElRef}
              src={imageSrc}
              alt=""
              draggable={false}
              onLoad={handleImgLoad}
              style={{
                width: dw ? `${dw}px` : 'auto',
                height: dh ? `${dh}px` : 'auto',
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                opacity: imgLoaded ? 1 : 0,
                maxWidth: 'none',
              }}
            />
          )}
          {!imgLoaded && (
            <div className="photo-crop-loading"><span className="spinner-border-sm" /></div>
          )}
          <div className="photo-crop-mask" />
        </div>

        <div className="photo-crop-zoom-row">
          <i className="bi bi-dash-lg" />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!imgLoaded}
            onChange={(e) => changeZoom(parseFloat(e.target.value))}
            className="photo-crop-zoom-slider"
            aria-label="Zoom"
          />
          <i className="bi bi-plus-lg" />
        </div>
        <p className="photo-crop-hint">Drag to reposition &middot; pinch or use the slider to zoom</p>
      </div>

      <div className="photo-crop-actions">
        <button type="button" className="btn-ag ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        <ActionButton
          busy={busy}
          busyLabel="Processing..."
          className="btn-ag primary"
          onClick={handleDone}
          disabled={!imgLoaded}
        >
          <i className="bi bi-check-lg" /> Use Photo
        </ActionButton>
      </div>
    </Modal>
  );
}
