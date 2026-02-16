"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  phase: number;
  type: "dot" | "cross" | "sparkle";
}

export default function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let stars: Star[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    const initStars = () => {
      const count = Math.floor((canvas.width * canvas.height) / 5000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 0.8 + 0.3,
        phase: Math.random() * Math.PI * 2,
        type: randomType(),
      }));
    };

    const randomType = (): Star["type"] => {
      const r = Math.random();
      if (r < 0.15) return "sparkle";
      if (r < 0.4) return "cross";
      return "dot";
    };

    // Croix pixelisée (style Pokémon Gold)
    const drawPixelCross = (
      x: number,
      y: number,
      size: number,
      color: string
    ) => {
      const s = Math.round(size);
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), s, s);
      ctx.fillRect(Math.round(x), Math.round(y - s), s, s);
      ctx.fillRect(Math.round(x), Math.round(y + s), s, s);
      ctx.fillRect(Math.round(x - s), Math.round(y), s, s);
      ctx.fillRect(Math.round(x + s), Math.round(y), s, s);
    };

    // Sparkle 4 branches (les étoiles brillantes de l'intro Gold)
    const drawSparkle = (
      x: number,
      y: number,
      size: number,
      color: string
    ) => {
      const s = Math.round(size);
      ctx.fillStyle = color;
      // Centre
      ctx.fillRect(Math.round(x), Math.round(y), s, s);
      // Branches verticales
      ctx.fillRect(Math.round(x), Math.round(y - s), s, s);
      ctx.fillRect(Math.round(x), Math.round(y - s * 2), s, s);
      ctx.fillRect(Math.round(x), Math.round(y + s), s, s);
      ctx.fillRect(Math.round(x), Math.round(y + s * 2), s, s);
      // Branches horizontales
      ctx.fillRect(Math.round(x - s), Math.round(y), s, s);
      ctx.fillRect(Math.round(x - s * 2), Math.round(y), s, s);
      ctx.fillRect(Math.round(x + s), Math.round(y), s, s);
      ctx.fillRect(Math.round(x + s * 2), Math.round(y), s, s);
      // Diagonales
      ctx.fillRect(Math.round(x - s), Math.round(y - s), s, s);
      ctx.fillRect(Math.round(x + s), Math.round(y - s), s, s);
      ctx.fillRect(Math.round(x - s), Math.round(y + s), s, s);
      ctx.fillRect(Math.round(x + s), Math.round(y + s), s, s);
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const star of stars) {
        const flicker = Math.sin(time * 0.001 * star.speed + star.phase);
        const alpha = 0.15 + (flicker + 1) * 0.42;

        // Couleurs Gold/Silver : dorées et blanches
        const isGold = star.type === "sparkle" || star.phase > 4;
        const color = isGold
          ? `rgba(248, 208, 48, ${alpha})`
          : `rgba(200, 220, 255, ${alpha})`;

        if (star.type === "sparkle") {
          if (alpha > 0.6) {
            drawSparkle(star.x, star.y, star.size, color);
          }
        } else if (star.type === "cross") {
          drawPixelCross(star.x, star.y, star.size, color);
        } else {
          const s = Math.round(star.size);
          ctx.fillStyle = color;
          ctx.fillRect(Math.round(star.x), Math.round(star.y), s, s);
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();
    animationId = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ imageRendering: "pixelated" }}
      aria-hidden="true"
    />
  );
}