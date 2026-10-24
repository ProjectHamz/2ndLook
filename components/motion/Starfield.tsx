"use client";

/**
 * Twinkling starfield for the dark hero. Stars drift very slowly upward and twinkle at
 * their own pace; stars near the cursor glow brighter. Static with prefers-reduced-motion,
 * paused when offscreen.
 */
import { useEffect, useRef } from "react";

type Star = { x: number; y: number; r: number; base: number; speed: number; phase: number; drift: number };

export default function Starfield({ density = 0.00022, className = "" }: { density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    let raf = 0;
    let visible = true;
    const mouse = { x: -9999, y: -9999 };

    const seed = () => {
      const n = Math.round(w * h * density);
      stars = Array.from({ length: n }, () => {
        const bright = Math.random() < 0.08;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: bright ? 1.4 + Math.random() * 0.8 : 0.6 + Math.random() * 0.7,
          base: bright ? 0.75 : 0.25 + Math.random() * 0.4,
          speed: 0.4 + Math.random() * 1.6,
          phase: Math.random() * Math.PI * 2,
          drift: 2 + Math.random() * 6,
        };
      });
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const draw = (t: number) => {
      const s = t / 1000;
      ctx.clearRect(0, 0, w, h);
      for (const st of stars) {
        const y = reduce ? st.y : (((st.y - s * st.drift) % h) + h) % h;
        const tw = reduce ? 1 : 0.55 + 0.45 * Math.sin(s * st.speed + st.phase);
        const dx = st.x - mouse.x;
        const dy = y - mouse.y;
        const near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 160);
        const a = Math.min(1, st.base * tw + near * 0.6);
        const r = st.r * (1 + near * 0.8);
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(st.x, y, r, 0, Math.PI * 2);
        ctx.fill();
        if (st.r > 1.3 && tw > 0.9) {
          // brief glint on the brightest stars
          ctx.fillStyle = `rgba(255,255,255,${((tw - 0.9) * 2.5).toFixed(3)})`;
          ctx.fillRect(st.x - r * 3, y - 0.25, r * 6, 0.5);
          ctx.fillRect(st.x - 0.25, y - r * 3, 0.5, r * 6);
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
    window.addEventListener("pointermove", onMove, { passive: true });

    if (reduce) draw(0);
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, [density]);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none block h-full w-full ${className}`} />;
}
