"use client";

import { useState, useEffect } from "react";

// Sprite œuf officiel PokeAPI
const EGG_SPRITE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/egg.png";
// Fallback si l'artwork n'existe pas
const EGG_SPRITE_FALLBACK = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mystery-egg.png";

type HatchPhase = "idle" | "wobble" | "shake" | "flash" | "reveal";

interface EggHatchProps {
  onHatch: () => Promise<void>;
  hatchResult: {
    name: string;
    sprite: string;
    isShiny: boolean;
    rarity: string;
    types: string[];
  } | null;
  canHatch: boolean;
  loading: boolean;
}

export default function EggHatch({ onHatch, hatchResult, canHatch, loading }: EggHatchProps) {
  const [phase, setPhase] = useState<HatchPhase>("idle");
  const [eggSrc, setEggSrc] = useState(EGG_SPRITE);

  // Reset la phase si on revient sans résultat
  useEffect(() => {
    if (!hatchResult) setPhase("idle");
  }, [hatchResult]);

  const handleEggClick = () => {
    if (!canHatch || loading || phase !== "idle") return;

    // Phase 1 : Wobble (léger tremblement)
    setPhase("wobble");

    // Lancer l'appel API en arrière-plan (ne pas bloquer le timing d'anim)
    onHatch().catch((err) => {
      console.error("Hatch error:", err);
    });

    // Phase 2 : Shake (tremblement fort) après ~0.9s
    setTimeout(() => setPhase("shake"), 900);

    // Phase 3 : Flash blanc après ~2.2s (fin du gros tremblement)
    setTimeout(() => setPhase("flash"), 2200);

    // Phase 4 : Reveal après le flash (~3s après le tap)
    setTimeout(() => setPhase("reveal"), 3000);
  };

  // Pas d'éclosion aujourd'hui
  if (!canHatch && !hatchResult) {
    return (
      <div className="text-center pixel-box p-8 w-full">
        <p className="font-[family-name:var(--font-pixel)] text-sm text-yellow-400 mb-3">
          Terminé !
        </p>
        <p className="font-[family-name:var(--font-pixel)] text-xs text-slate-300 leading-relaxed">
          Reviens demain pour une nouvelle éclosion !
        </p>
      </div>
    );
  }

  // Résultat affiché (phase reveal)
  if (hatchResult && phase === "reveal") {
    return (
      <div className="text-center pixel-box p-6 w-full">
        {hatchResult.isShiny && (
          <p className="font-[family-name:var(--font-pixel)] text-yellow-400 text-xs mb-3 animate-pulse">
            SHINY !
          </p>
        )}
        <div className="relative inline-block">
          <img
            src={hatchResult.sprite}
            alt={hatchResult.name}
            className="w-48 h-48 mx-auto drop-shadow-xl"
            style={{ animation: "pokemon-reveal 0.8s ease-out forwards" }}
          />
          {/* Sparkles */}
          {[...Array(6)].map((_, i) => (
            <span
              key={i}
              className="absolute font-[family-name:var(--font-pixel)] text-yellow-400 text-xs pointer-events-none"
              style={{
                top: `${20 + Math.random() * 60}%`,
                left: `${10 + Math.random() * 80}%`,
                animation: `sparkle-float 1.2s ease-out ${i * 0.2}s forwards`,
                opacity: 0,
              }}
            >
              ✦
            </span>
          ))}
        </div>
        <h2 className="font-[family-name:var(--font-pixel)] text-white text-sm mt-4">
          {hatchResult.name}
        </h2>
        <p
          className="font-[family-name:var(--font-pixel)] text-xs mt-2"
          style={{ color: getRarityColor(hatchResult.rarity) }}
        >
          {hatchResult.rarity.toUpperCase()}
        </p>
        <div className="flex gap-2 justify-center mt-3">
          {hatchResult.types.map((type) => (
            <span
              key={type}
              className="px-3 py-1 text-xs font-medium text-white"
              style={{
                backgroundColor: getTypeColor(type),
                borderRadius: "4px",
              }}
            >
              {type}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Œuf (idle, wobble, shake, flash)
  return (
    <div className="text-center relative">
      <p className="font-[family-name:var(--font-pixel)] text-xs text-slate-300 mb-6">
        {phase === "idle" && "Ton oeuf est prêt !"}
        {phase === "wobble" && "Oh ?"}
        {phase === "shake" && "...!"}
        {phase === "flash" && ""}
      </p>

      {/* Flash overlay */}
      {phase === "flash" && (
        <div
          className="fixed inset-0 z-50 bg-white pointer-events-none"
          style={{ animation: "hatch-flash 0.8s ease-in-out forwards" }}
        />
      )}

      <button
        onClick={handleEggClick}
        disabled={phase !== "idle"}
        className="relative disabled:cursor-default"
      >
        <img
          src={eggSrc}
          alt="Oeuf Pokémon"
          className={`w-40 h-40 mx-auto drop-shadow-lg ${
            phase === "wobble"
              ? "egg-anim-wobble"
              : phase === "shake"
              ? "egg-anim-shake"
              : ""
          } ${phase === "flash" ? "opacity-0" : ""}`}
          style={{
            imageRendering: eggSrc === EGG_SPRITE_FALLBACK ? "pixelated" : "auto",
          }}
          onError={() => setEggSrc(EGG_SPRITE_FALLBACK)}
        />
      </button>

      <p className="font-[family-name:var(--font-pixel)] text-xs text-slate-400 mt-6">
        {phase === "idle" && "Tape sur l'oeuf !"}
        {phase === "wobble" && ""}
        {phase === "shake" && ""}
      </p>
    </div>
  );
}

function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    common: "#78C850", uncommon: "#6890F0", rare: "#A040A0",
    epic: "#F08030", legendary: "#F8D030",
  };
  return colors[rarity] ?? "#FFFFFF";
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    normal: "#A8A77A", fire: "#EE8130", water: "#6390F0",
    electric: "#F7D02C", grass: "#7AC74C", ice: "#96D9D6",
    fighting: "#C22E28", poison: "#A33EA1", ground: "#E2BF65",
    flying: "#A98FF3", psychic: "#F95587", bug: "#A6B91A",
    rock: "#B6A136", ghost: "#735797", dragon: "#6F35FC",
    dark: "#705746", steel: "#B7B7CE", fairy: "#D685AD",
  };
  return colors[type] ?? "#777777";
}