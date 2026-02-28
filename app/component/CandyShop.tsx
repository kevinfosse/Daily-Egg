"use client";

import { useEffect, useState } from "react";

interface Pokemon {
  pokedexId: number;
  name: string;
  sprite: string;
  rarity: string;
  isShiny: boolean;
  count: number;
}

interface CandyShopProps {
  isOpen: boolean;
  onClose: () => void;
  candy: number;
  onCandyChange: (newCandy: number, updates?: { bonusEggs?: number; mysteryTickets?: number }) => void;
}

const CANDY_VALUE: Record<string, number> = {
  common: 1,
  uncommon: 3,
  rare: 10,
  epic: 30,
  legendary: 100,
};

const RARITY_COLORS: Record<string, string> = {
  common: "#78C850",
  uncommon: "#6890F0",
  rare: "#A040A0",
  epic: "#F08030",
  legendary: "#F8D030",
};

const RARITY_LABELS: Record<string, string> = {
  common: "Commun",
  uncommon: "Peu commun",
  rare: "Rare",
  epic: "Épique",
  legendary: "Légendaire",
};

const SHOP_ITEMS = [
  {
    id: "bonusEgg",
    label: "Œuf Bonus",
    emoji: "🥚",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lucky-egg.png",
    cost: 50,
    description: "Éclore un Pokémon supplémentaire",
    bg: "#7c3aed",
    border: "#5b21b6",
  },
  {
    id: "mysteryTicket",
    label: "Ticket Mystère",
    emoji: "🎫",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png",
    cost: 200,
    description: "Garantit Rare+ au minimum",
    bg: "#ca8a04",
    border: "#92400e",
  },
];

export default function CandyShop({ isOpen, onClose, candy, onCandyChange }: CandyShopProps) {
  const [tab, setTab] = useState<"convert" | "shop">("convert");
  const [duplicates, setDuplicates] = useState<Pokemon[]>([]);
  const [loadingExchange, setLoadingExchange] = useState<string | null>(null);
  const [loadingSpend, setLoadingSpend] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/user/collection")
      .then((r) => r.json())
      .then((data) => {
        const pokemons: Pokemon[] = data.pokemons || [];
        const dupes = pokemons.filter((p) => p.count > 1);
        setDuplicates(dupes);
      })
      .catch(() => {});
  }, [isOpen]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleExchange = async (pokemon: Pokemon) => {
    const key = `${pokemon.pokedexId}-${pokemon.isShiny}`;
    setLoadingExchange(key);
    try {
      const res = await fetch("/api/candy/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pokedexId: pokemon.pokedexId, isShiny: pokemon.isShiny }),
      });
      const data = await res.json();
      if (res.ok) {
        onCandyChange(data.candy);
        setDuplicates((prev) =>
          prev
            .map((p) =>
              p.pokedexId === pokemon.pokedexId && p.isShiny === pokemon.isShiny
                ? { ...p, count: 1 }
                : p
            )
            .filter((p) => p.count > 1)
        );
        showToast(`+${data.candyEarned} 🍬 pour ${data.pokemonName}`);
      } else {
        showToast(data.error || "Erreur");
      }
    } catch {
      showToast("Erreur réseau");
    }
    setLoadingExchange(null);
  };

  const handleSpend = async (itemId: string) => {
    setLoadingSpend(itemId);
    try {
      const res = await fetch("/api/candy/spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: itemId }),
      });
      const data = await res.json();
      if (res.ok) {
        onCandyChange(data.candy, {
          bonusEggs: data.bonusEggs,
          mysteryTickets: data.mysteryTickets,
        });
        const item = SHOP_ITEMS.find((i) => i.id === itemId);
        showToast(`${item?.emoji} ${item?.label} obtenu !`);
      } else {
        showToast(data.error || "Erreur");
      }
    } catch {
      showToast("Erreur réseau");
    }
    setLoadingSpend(null);
  };

  const previewCandy = (pokemon: Pokemon) => {
    const base = CANDY_VALUE[pokemon.rarity] ?? 1;
    return (pokemon.count - 1) * base * (pokemon.isShiny ? 5 : 1);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
    >
      <div
        className="relative w-full max-w-sm rounded-xl flex flex-col"
        style={{
          background: "linear-gradient(135deg, #1a0a2e 0%, #0f172a 100%)",
          border: "2px solid #ec4899",
          boxShadow: "0 0 32px rgba(236,72,153,0.4)",
          maxHeight: "90vh",
        }}
      >
        {/* Toast */}
        {toast && (
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-lg text-white text-xs font-bold whitespace-nowrap"
            style={{
              background: "rgba(0,0,0,0.9)",
              border: "1px solid #ec4899",
              fontFamily: "var(--font-pixel)",
            }}
          >
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-pink-900">
          <div className="flex items-center gap-3">
            <img
              src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png"
              alt=""
              className="w-8 h-8"
              style={{ imageRendering: "pixelated" }}
            />
            <div>
              <h2
                className="text-sm font-bold text-pink-400"
                style={{ fontFamily: "var(--font-pixel)" }}
              >
                Candy Shop
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Solde :{" "}
                <span className="text-pink-300 font-bold">{candy}</span>
                <img
                  src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png"
                  alt=""
                  className="w-4 h-4 inline-block ml-1"
                  style={{ imageRendering: "pixelated" }}
                />
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-pink-900">
          {(["convert", "shop"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 text-[10px] font-bold transition-colors"
              style={{
                fontFamily: "var(--font-pixel)",
                color: tab === t ? "#ec4899" : "#94a3b8",
                borderBottom: tab === t ? "2px solid #ec4899" : "2px solid transparent",
                background: "transparent",
              }}
            >
              {t === "convert" ? "Convertir" : "Boutique"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4">
          {tab === "convert" && (
            <div>
              <p
                className="text-[9px] text-slate-500 mb-3 text-center flex items-center justify-center gap-1"
                style={{ fontFamily: "var(--font-pixel)" }}
              >
                Convertis tes doublons en
                <img
                  src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png"
                  alt="candy"
                  className="w-4 h-4 inline-block"
                  style={{ imageRendering: "pixelated" }}
                />
              </p>

              {duplicates.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-4xl mb-3">😴</p>
                  <p
                    className="text-[9px] text-slate-500"
                    style={{ fontFamily: "var(--font-pixel)" }}
                  >
                    Aucun doublon pour l'instant
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {duplicates.map((p) => {
                    const key = `${p.pokedexId}-${p.isShiny}`;
                    const preview = previewCandy(p);
                    const rarityColor = RARITY_COLORS[p.rarity] || "#fff";
                    const isLoading = loadingExchange === key;

                    return (
                      <div
                        key={key}
                        className="flex items-center gap-3 rounded-lg p-2"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: `1px solid ${rarityColor}44`,
                        }}
                      >
                        <div className="relative flex-shrink-0">
                          <img
                            src={p.sprite}
                            alt={p.name}
                            width={48}
                            height={48}
                            className={p.isShiny ? "drop-shadow-[0_0_6px_gold]" : ""}
                          />
                          {p.isShiny && (
                            <span className="absolute -top-1 -right-1 text-[10px]">✨</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p
                            className="text-xs font-bold capitalize truncate"
                            style={{ color: rarityColor }}
                          >
                            {p.name}
                          </p>
                          <p
                            className="text-[9px] text-slate-400"
                            style={{ fontFamily: "var(--font-pixel)" }}
                          >
                            {RARITY_LABELS[p.rarity]} · x{p.count}
                          </p>
                          <p
                            className="text-[9px] text-pink-400 mt-0.5 flex items-center gap-1"
                            style={{ fontFamily: "var(--font-pixel)" }}
                          >
                            +{preview}
                            <img
                              src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png"
                              alt=""
                              className="w-3 h-3 inline-block"
                              style={{ imageRendering: "pixelated" }}
                            />
                            {p.isShiny ? "(×5 shiny)" : ""}
                          </p>
                        </div>

                        <button
                          onClick={() => handleExchange(p)}
                          disabled={isLoading}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-bold text-white disabled:opacity-50"
                          style={{
                            fontFamily: "var(--font-pixel)",
                            background: "#ec4899",
                            borderBottom: "2px solid #9d174d",
                          }}
                        >
                          {isLoading ? "..." : "Convertir"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "shop" && (
            <div>
              <p
                className="text-[9px] text-slate-500 mb-3 text-center flex items-center justify-center gap-1"
                style={{ fontFamily: "var(--font-pixel)" }}
              >
                Dépense tes
                <img
                  src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png"
                  alt="candy"
                  className="w-4 h-4 inline-block"
                  style={{ imageRendering: "pixelated" }}
                />
              </p>

              <div className="space-y-3">
                {SHOP_ITEMS.map((item) => {
                  const canAfford = candy >= item.cost;
                  const isLoading = loadingSpend === item.id;

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl p-4"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${item.bg}66`,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <img
                              src={item.sprite}
                              alt={item.label}
                              className="w-8 h-8"
                              style={{ imageRendering: "pixelated" }}
                            />
                            <p
                              className="text-sm font-bold text-white"
                              style={{ fontFamily: "var(--font-pixel)" }}
                            >
                              {item.label}
                            </p>
                          </div>
                          <p className="text-[9px] text-slate-400 mt-1">
                            {item.description}
                          </p>
                          <p
                            className="text-[10px] text-pink-300 font-bold mt-1 flex items-center gap-1"
                            style={{ fontFamily: "var(--font-pixel)" }}
                          >
                            {item.cost}
                            <img
                              src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png"
                              alt=""
                              className="w-4 h-4 inline-block"
                              style={{ imageRendering: "pixelated" }}
                            />
                          </p>
                        </div>

                        <button
                          onClick={() => handleSpend(item.id)}
                          disabled={!canAfford || isLoading}
                          className="px-4 py-2 rounded-lg text-[9px] font-bold text-white disabled:opacity-40 flex-shrink-0"
                          style={{
                            fontFamily: "var(--font-pixel)",
                            background: canAfford ? item.bg : "#374151",
                            borderBottom: `2px solid ${canAfford ? item.border : "#1f2937"}`,
                          }}
                        >
                          {isLoading ? "..." : "Acheter"}
                        </button>
                      </div>

                      {!canAfford && (
                        <p
                          className="text-[8px] text-slate-600 mt-2 text-right flex items-center justify-end gap-1"
                          style={{ fontFamily: "var(--font-pixel)" }}
                        >
                          Il te manque {item.cost - candy}
                          <img
                            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png"
                            alt=""
                            className="w-3 h-3 inline-block"
                            style={{ imageRendering: "pixelated" }}
                          />
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
