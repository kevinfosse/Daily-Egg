"use client";

import { useState, useEffect, useCallback } from "react";

interface Pokemon {
  pokedexId: number;
  name: string;
  types: string[];
  sprite: string;
  isShiny: boolean;
  rarity: string;
  count: number;
}

interface WonderTradeProps {
  isOpen: boolean;
  onClose: () => void;
  onTradeComplete?: () => void;
}

type Phase = "select" | "trading" | "result";

export default function WonderTrade({ isOpen, onClose, onTradeComplete }: WonderTradeProps) {
  const [phase, setPhase] = useState<Phase>("select");
  const [pokemons, setPokemons] = useState<Pokemon[]>([]);
  const [tradesRemaining, setTradesRemaining] = useState(3);
  const [poolSize, setPoolSize] = useState(0);
  const [selected, setSelected] = useState<Pokemon | null>(null);
  const [received, setReceived] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const tradeRes = await fetch("/api/wonder-trade");
      if (tradeRes.ok) {
        const data = await tradeRes.json();
        setTradesRemaining(data.tradesRemaining);
        setPoolSize(data.poolSize);
      }

      // Fetch pokemon collection
      const pokesRes = await fetch("/api/user/collection");
      if (pokesRes.ok) {
        const pokesData = await pokesRes.json();
        setPokemons(pokesData.pokemons || []);
      }
    } catch (e) {
      console.error("Failed to fetch trade data:", e);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPhase("select");
      setSelected(null);
      setReceived(null);
      setError(null);
      fetchData();
    }
  }, [isOpen, fetchData]);

  const handleTrade = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setPhase("trading");

    try {
      const res = await fetch("/api/wonder-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pokedexId: selected.pokedexId,
          isShiny: selected.isShiny,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur lors de l'échange");
        setPhase("select");
        setLoading(false);
        return;
      }

      // Animate for 2 seconds then show result
      setTimeout(() => {
        setReceived(data.received);
        setTradesRemaining(data.tradesRemaining);
        setPhase("result");
        setLoading(false);
        onTradeComplete?.();
      }, 2000);
    } catch (e) {
      console.error("Trade failed:", e);
      setError("Erreur réseau");
      setPhase("select");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="pixel-box p-6 w-full max-w-sm max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-[family-name:var(--font-pixel)] text-sm text-yellow-400">
            Wonder Trade
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">
            &times;
          </button>
        </div>

        <div className="flex justify-between mb-4">
          <span className="font-[family-name:var(--font-pixel)] text-[10px] text-slate-400">
            {tradesRemaining}/3 restants
          </span>
          <span className="font-[family-name:var(--font-pixel)] text-[10px] text-slate-400">
            {poolSize} dans le pool
          </span>
        </div>

        {error && (
          <p className="text-red-400 text-xs text-center mb-3">{error}</p>
        )}

        {/* Phase: Select */}
        {phase === "select" && (
          <>
            <p className="text-slate-300 text-xs text-center mb-3">
              Choisis un Pokémon à échanger
            </p>
            <div className="grid grid-cols-4 gap-2 max-h-[40vh] overflow-y-auto mb-4">
              {pokemons.map((p) => {
                const isLegendary = p.rarity === "legendary";
                const isSelected = selected?.pokedexId === p.pokedexId && selected?.isShiny === p.isShiny;
                return (
                  <button
                    key={`${p.pokedexId}-${p.isShiny}`}
                    onClick={() => !isLegendary && setSelected(p)}
                    disabled={isLegendary}
                    className={`relative p-1 rounded border transition-all ${
                      isLegendary
                        ? "opacity-30 cursor-not-allowed border-slate-700"
                        : isSelected
                        ? "border-yellow-400 bg-yellow-400/10"
                        : "border-slate-600 hover:border-slate-400"
                    }`}
                  >
                    <img
                      src={p.sprite}
                      alt={p.name}
                      className="w-full aspect-square object-contain"
                    />
                    {p.isShiny && (
                      <span className="absolute top-0 right-0 text-[8px]">S</span>
                    )}
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className="text-center mb-3">
                <p className="text-white text-xs">
                  {selected.name} {selected.isShiny ? "(Shiny)" : ""}
                </p>
                <p className="text-slate-400 text-[10px]" style={{ color: getRarityColor(selected.rarity) }}>
                  {selected.rarity.toUpperCase()}
                </p>
              </div>
            )}

            <button
              onClick={handleTrade}
              disabled={!selected || tradesRemaining <= 0 || loading}
              className="w-full pixel-button px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {tradesRemaining <= 0 ? "Plus d'échanges" : "Échanger"}
            </button>
          </>
        )}

        {/* Phase: Trading animation */}
        {phase === "trading" && (
          <div className="text-center py-12">
            <div className="text-4xl animate-spin mb-4" style={{ animationDuration: "1s" }}>
              ?
            </div>
            <p className="font-[family-name:var(--font-pixel)] text-xs text-yellow-400 animate-pulse">
              Échange en cours...
            </p>
          </div>
        )}

        {/* Phase: Result */}
        {phase === "result" && received && (
          <div className="text-center py-6">
            <p className="font-[family-name:var(--font-pixel)] text-xs text-slate-300 mb-4">
              Tu as reçu :
            </p>
            {received.isShiny && (
              <p className="font-[family-name:var(--font-pixel)] text-yellow-400 text-xs mb-2 animate-pulse">
                SHINY !
              </p>
            )}
            <img
              src={received.sprite}
              alt={received.name}
              className="w-32 h-32 mx-auto drop-shadow-xl"
              style={{ animation: "pokemon-reveal 0.8s ease-out forwards" }}
            />
            <h3 className="font-[family-name:var(--font-pixel)] text-white text-sm mt-3">
              {received.name}
            </h3>
            <p
              className="font-[family-name:var(--font-pixel)] text-xs mt-1"
              style={{ color: getRarityColor(received.rarity) }}
            >
              {received.rarity.toUpperCase()}
            </p>
            <div className="flex gap-2 justify-center mt-2">
              {received.types?.map((type: string) => (
                <span
                  key={type}
                  className="px-2 py-0.5 text-[10px] text-white rounded"
                  style={{ backgroundColor: getTypeColor(type) }}
                >
                  {type}
                </span>
              ))}
            </div>
            <button
              onClick={() => {
                setPhase("select");
                setSelected(null);
                setReceived(null);
                fetchData();
              }}
              className="mt-6 pixel-button px-4 py-2 text-xs font-bold text-white"
            >
              {tradesRemaining > 0 ? "Encore ?" : "Fermer"}
            </button>
          </div>
        )}
      </div>
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
