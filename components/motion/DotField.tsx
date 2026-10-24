"use client";

/**
 * Animated dot grid with a slowly drifting grid behind it. Dots brighten in a travelling
 * wave and swell near the cursor. Static frame with prefers-reduced-motion; pauses offscreen.
 */
import { useEffect, useRef } from "react";

const GAP = 22;
const INK = "46, 59, 50"; // pine

export default function DotField({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;
    const mouse = { x: -9999, y: -9999 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (t: number) => {
      const s = t / 1000;
      ctx.clearRect(0, 0, w, h);
      const drift = reduce ? 0 : (s * 6) % GAP;

      // moving grid lines, every 4 dots
      ctx.strokeStyle = `rgba(${INK}, 0.06)`;
      ctx.lineWidth = 1;
      const big = GAP * 4;
      const off = reduce ? 0 : (s * 6) % big;
      ctx.beginPath();
      for (let x = -big + off; x < w + big; x += big) {
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, h);
      }
      for (let y = -big + off; y < h + big; y += big) {
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(w, Math.round(y) + 0.5);
      }
      ctx.stroke();

      // dots
      for (let y = -GAP + drift; y < h + GAP; y += GAP) {
        for (let x = -GAP + drift; x < w + GAP; x += GAP) {
          const wave = Math.max(0, Math.sin(x * 0.012 + y * 0.009 - s * 1.1));
          const dx = x - mouse.x;
          const dy = y - mouse.y;
          const near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 140);
          const a = 0.1 + wave * wave * 0.28 + near * 0.5;
          const r = 1 + wave * 0.5 + near * 1.6;
          ctx.fillStyle = `rgba(${INK}, ${a.toFixed(3)})`;
          ctx.fillRect(x - r / 2, y - r / 2, r, r);
        }
      }
    };

    const loop = (t: number) => {
      if (visible) draw(t);
      raf = requestAnimationFrame(loop);
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) draw(0);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = Boolean(e?.isIntersecting);
    });
    io.observe(canvas);
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.x = mouse.y = -9999;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    if (reduce) draw(0);
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none block h-full w-full ${className}`} />;
}
