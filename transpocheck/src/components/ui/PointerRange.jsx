import React, { useRef } from 'react';

/**
 * Reemplazo táctil de <input type="range"> SIN elemento <input>.
 * Motivo: en algunos móviles/WebViews, tocar un range invisible (opacity-0)
 * mantiene o abre el teclado numérico (p. ej. el del odómetro).
 * Este control usa Pointer Events, cierra el teclado al tocarlo y entrega
 * directamente el valor numérico en onChange(value).
 */
export default function PointerRange({
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  className = '',
  ariaLabel = 'Nivel',
  style
}) {
  const ref = useRef(null);
  const draggingRef = useRef(false);

  const clamp = (n) => Math.min(max, Math.max(min, n));
  const snap = (n) => clamp(Number((Math.round((n - min) / step) * step + min).toFixed(4)));

  const updateFromX = (clientX) => {
    const el = ref.current;
    if (!el || clientX == null) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const next = snap(min + ratio * (max - min));
    if (next !== value) onChange(next);
  };

  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Cierra cualquier teclado abierto (ej. input numérico del odómetro)
    const active = document.activeElement;
    if (active && active !== document.body && active !== e.currentTarget && typeof active.blur === 'function') {
      active.blur();
    }
    draggingRef.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    updateFromX(e.clientX);
  };

  const handlePointerMove = (e) => {
    if (draggingRef.current) updateFromX(e.clientX);
  };

  const stopDragging = (e) => {
    draggingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
  };

  const handleKeyDown = (e) => {
    const current = value ?? min;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = snap(current + step);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = snap(current - step);
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    if (next !== null) {
      e.preventDefault();
      if (next !== value) onChange(next);
    }
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value ?? min}
      className={`select-none outline-none ${className}`}
      style={{ touchAction: 'pan-y', WebkitTapHighlightColor: 'transparent', ...style }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onKeyDown={handleKeyDown}
    />
  );
}
