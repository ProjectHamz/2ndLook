"use client";

/**
 * The Blender-rendered hero loop (public/media/hero-cards.mp4), rendered on the same
 * night color as the hero so it blends in. The edges are feathered so any small color
 * shift from video compression disappears. Shows the still poster with reduced motion.
 */
import { useEffect, useRef, useState } from "react";

export default function HeroLoop() {
  const ref = useRef<HTMLVideoElement>(null);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduce(r);
    if (r) ref.current?.pause();
  }, []);

  return (
    <div className="relative aspect-square w-full max-w-[520px] [mask-composite:intersect] [mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent),linear-gradient(to_bottom,transparent,#000_7%,#000_93%,transparent)]">
      <video
        ref={ref}
        className="h-full w-full object-cover"
        src="/media/hero-cards.mp4"
        poster="/media/hero-cards-poster.jpg"
        autoPlay={!reduce}
        muted
        loop
        playsInline
        preload="auto"
        aria-label="Three deal cards. The front card's pass reason is struck through and each pass risk turns De-risked."
      />
    </div>
  );
}
