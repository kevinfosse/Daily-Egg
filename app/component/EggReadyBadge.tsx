"use client";

import { useState, useEffect } from "react";

interface EggReadyBadgeProps {
  canHatch: boolean;
}

export default function EggReadyBadge({ canHatch }: EggReadyBadgeProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (canHatch) {
      // Small delay for entrance animation
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [canHatch]);

  if (!canHatch) return null;

  return (
    <div
      className={`
        fixed top-4 right-4 z-40
        transition-all duration-300 ease-out
        ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"}
      `}
    >
      <div className="pixel-box p-3 egg-ready-badge">
        <div className="flex items-center gap-2">
          {/* Animated egg icon */}
          <div className="relative">
            <span className="text-2xl egg-bounce">🥚</span>
            {/* Sparkle effect */}
            <span className="absolute -top-1 -right-1 text-xs sparkle-anim">✨</span>
          </div>

          <div>
            <p className="font-[family-name:var(--font-pixel)] text-[10px] text-yellow-400">
              Oeuf pret !
            </p>
            <p className="text-slate-400 text-[10px]">
              A eclore
            </p>
          </div>
        </div>

        {/* Pulse ring */}
        <div className="absolute inset-0 rounded egg-pulse-ring pointer-events-none" />
      </div>
    </div>
  );
}
