"use client";

import { useEffect, useState, useCallback } from "react";
import type { HatchedPokemon } from "@/app/types";

interface Expedition {
  pokedexId: number;
  isShiny: boolean;
  pokemonName: string;
  pokemonSprite: string;
  pokemonRarity: string;
  startedAt: string;
  endsAt: string;
  equippedItem?: string | null;
}

const ITEM_EMOJIS: Record<string, string> = {
  incense_rare: "🌿",
  incense_epic: "🔮",
  rare_candy: "🍭",
  amulet_coin: "💰",
  macho_brace: "💪",
  lum_berry: "🍒",
};

const ITEM_SPRITES: Record<string, string> = {
  incense_rare: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lax-incense.png",
  incense_epic: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sea-incense.png",
  rare_candy: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png",
  amulet_coin: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/amulet-coin.png",
  macho_brace: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/macho-brace.png",
  lum_berry: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lum-berry.png",
};

interface ExpeditionsProps {
  isOpen: boolean;
  onClose: () => void;
  onRewardClaimed: (updates: { candy: number; bonusEggs: number; mysteryTickets: number }) => void;
}

function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    common: "#78C850",
    uncommon: "#6890F0",
    rare: "#A040A0",
    epic: "#F08030",
    legendary: "#F8D030",
  };
  return colors[rarity] ?? "#FFFFFF";
}

function useCountdown(endsAt: string): string {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function update() {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) {
        setLabel("Terminé !");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(`${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return label;
}

function ExpeditionCard({
  expedition,
  onClaim,
  claiming,
}: {
  expedition: Expedition;
  onClaim: () => void;
  claiming: boolean;
}) {
  const countdown = useCountdown(expedition.endsAt);
  const isDone = new Date(expedition.endsAt) <= new Date();

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg"
      style={{
        background: isDone ? "rgba(34,197,94,0.1)" : "rgba(30,41,59,0.8)",
        border: `1px solid ${isDone ? "#22c55e" : "#2a3a4e"}`,
      }}
    >
      <img
        src={expedition.pokemonSprite}
        alt={expedition.pokemonName}
        className="w-12 h-12 object-contain flex-shrink-0"
        style={{ imageRendering: "pixelated" }}
      />
      <div className="flex-1 min-w-0">
        <p className="font-[family-name:var(--font-pixel)] text-[9px] text-white truncate">
          {expedition.pokemonName}
          {expedition.isShiny && (
            <span className="text-yellow-400 ml-1">★</span>
          )}
        </p>
        <p
          className="font-[family-name:var(--font-pixel)] text-[7px] mt-0.5"
          style={{ color: getRarityColor(expedition.pokemonRarity) }}
        >
          {expedition.pokemonRarity.toUpperCase()}
        </p>
        <p className={`font-[family-name:var(--font-pixel)] text-[8px] mt-1 ${isDone ? "text-green-400" : "text-slate-400"}`}>
          {countdown}
        </p>
        {expedition.equippedItem && (
          <p className="font-[family-name:var(--font-pixel)] text-[7px] text-indigo-400 mt-0.5 flex items-center gap-1">
            {ITEM_SPRITES[expedition.equippedItem] ? (
              <img
                src={ITEM_SPRITES[expedition.equippedItem]}
                alt=""
                className="w-4 h-4 inline-block"
                style={{ imageRendering: "pixelated" }}
              />
            ) : (ITEM_EMOJIS[expedition.equippedItem] ?? "📦")}
            actif
          </p>
        )}
      </div>
      {isDone && (
        <button
          onClick={onClaim}
          disabled={claiming}
          className="font-[family-name:var(--font-pixel)] text-[8px] px-3 py-1.5 rounded-lg text-white disabled:opacity-50 flex-shrink-0"
          style={{
            background: "#16a34a",
            border: "1px solid #15803d",
          }}
        >
          {claiming ? "..." : "Réclamer"}
        </button>
      )}
    </div>
  );
}

export default function Expeditions({ isOpen, onClose, onRewardClaimed }: ExpeditionsProps) {
  const [expeditions, setExpeditions] = useState<Expedition[]>([]);
  const [collection, setCollection] = useState<HatchedPokemon[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmPokemon, setConfirmPokemon] = useState<HatchedPokemon | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, colRes] = await Promise.all([
        fetch("/api/expeditions"),
        fetch("/api/user/collection"),
      ]);
      const expData = await expRes.json();
      const colData = await colRes.json();
      setExpeditions(expData.expeditions ?? []);
      setCollection(colData.pokemons ?? colData.hatchedPokemon ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    load();
  }, [isOpen, load]);

  // Show toast and auto-dismiss
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleClaim = async (exp: Expedition) => {
    const key = `${exp.pokedexId}-${exp.isShiny}`;
    setClaiming(key);
    try {
      const res = await fetch("/api/expeditions/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pokedexId: exp.pokedexId, isShiny: exp.isShiny }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Erreur");
        return;
      }
      setExpeditions(data.expeditions ?? []);
      onRewardClaimed({ candy: data.candy, bonusEggs: data.bonusEggs, mysteryTickets: data.mysteryTickets });

      const { candy, bonusEggs, mysteryTickets, itemDropped } = data.rewards;
      const parts: string[] = [`+${candy}🍬`];
      if (bonusEggs > 0) parts.push(`+${bonusEggs} Oeuf Bonus`);
      if (mysteryTickets > 0) parts.push(`+${mysteryTickets} Ticket Mystère`);
      if (itemDropped) parts.push(`${ITEM_EMOJIS[itemDropped] ?? "📦"} Objet trouvé !`);
      showToast(`${exp.pokemonName} est rentré ! ${parts.join(" · ")}`);

      // Refresh collection
      fetch("/api/user/collection")
        .then((r) => r.json())
        .then((d) => setCollection(d.pokemons ?? d.hatchedPokemon ?? []))
        .catch(() => {});
    } catch {
      showToast("Erreur réseau");
    } finally {
      setClaiming(null);
    }
  };

  const handleSend = async (pokemon: HatchedPokemon) => {
    const key = `${pokemon.pokedexId}-${pokemon.isShiny}`;
    setSending(key);
    setConfirmPokemon(null);
    try {
      const res = await fetch("/api/expeditions/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pokedexId: pokemon.pokedexId, isShiny: pokemon.isShiny }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Erreur");
        return;
      }
      setExpeditions(data.expeditions ?? []);
      showToast(`${pokemon.name} est parti en expédition (4h) !`);

      // Refresh collection
      fetch("/api/user/collection")
        .then((r) => r.json())
        .then((d) => setCollection(d.pokemons ?? d.hatchedPokemon ?? []))
        .catch(() => {});
    } catch {
      showToast("Erreur réseau");
    } finally {
      setSending(null);
    }
  };

  if (!isOpen) return null;

  // Pokemon available to send (not already on expedition)
  const expKeys = new Set(expeditions.map((e) => `${e.pokedexId}-${e.isShiny}`));
  const available = collection.filter((p) => !expKeys.has(`${p.pokedexId}-${p.isShiny}`));
  const slotsLeft = 3 - expeditions.length;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/70" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col"
        role="dialog"
        aria-label="Expéditions"
        style={{ background: "#0f172a", borderLeft: "2px solid #1e293b" }}
      >
        {/* Header */}
        <div
          className="px-4 pt-4 pb-3 flex items-center justify-between"
          style={{ borderBottom: "2px solid #1e293b" }}
        >
          <div>
            <h2 className="font-[family-name:var(--font-pixel)] text-sm text-orange-400">
              Expéditions
            </h2>
            <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-500 mt-0.5">
              {expeditions.length}/3 slots · {slotsLeft} disponible{slotsLeft !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 hover:text-white p-2"
          >
            FERMER
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">

          {/* Active expeditions */}
          <section>
            <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 mb-2">
              EN COURS
            </p>
            {loading && (
              <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-500 animate-pulse">
                Chargement...
              </p>
            )}
            {!loading && expeditions.length === 0 && (
              <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-600">
                Aucune expédition en cours.
              </p>
            )}
            {!loading && expeditions.map((exp) => {
              const key = `${exp.pokedexId}-${exp.isShiny}`;
              return (
                <div key={key} className="mb-2">
                  <ExpeditionCard
                    expedition={exp}
                    onClaim={() => handleClaim(exp)}
                    claiming={claiming === key}
                  />
                </div>
              );
            })}
          </section>

          {/* Send pokemon */}
          {slotsLeft > 0 && !loading && (
            <section>
              <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 mb-2">
                ENVOYER UN POKÉMON (4h · récompenses à la réclamation)
              </p>
              {available.length === 0 && (
                <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-600">
                  Aucun Pokémon disponible.
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {available.map((p) => {
                  const key = `${p.pokedexId}-${p.isShiny}`;
                  const isSending = sending === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setConfirmPokemon(p)}
                      disabled={isSending || !!sending}
                      className="p-2 text-center rounded-lg transition-all hover:scale-105 disabled:opacity-50"
                      style={{
                        background: "rgba(30,41,59,0.8)",
                        border: "1px solid #2a3a4e",
                      }}
                    >
                      <img
                        src={p.sprite}
                        alt={p.name}
                        className="mx-auto h-12 w-12 object-contain"
                        style={{ imageRendering: "pixelated" }}
                      />
                      <p className="font-[family-name:var(--font-pixel)] text-[7px] text-slate-300 mt-1 truncate">
                        {p.name}
                      </p>
                      <p
                        className="text-[6px] font-medium mt-0.5"
                        style={{ color: getRarityColor(p.rarity) }}
                      >
                        {p.rarity.toUpperCase()}
                      </p>
                      {p.isShiny && (
                        <p className="font-[family-name:var(--font-pixel)] text-[6px] text-yellow-400">★ SHINY</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Confirmation modal */}
        {confirmPokemon && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-6">
            <div
              className="w-full max-w-xs p-5 rounded-xl text-center"
              style={{ background: "#1e293b", border: "2px solid #334155" }}
            >
              <img
                src={confirmPokemon.sprite}
                alt={confirmPokemon.name}
                className="mx-auto w-20 h-20 object-contain mb-3"
                style={{ imageRendering: "pixelated" }}
              />
              <p className="font-[family-name:var(--font-pixel)] text-xs text-white mb-1">
                {confirmPokemon.name}
              </p>
              <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 mb-4">
                Envoyer en expédition (4h) ?{"\n"}Ce Pokémon sera absent de ta collection pendant ce temps.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setConfirmPokemon(null)}
                  className="font-[family-name:var(--font-pixel)] text-[8px] px-4 py-2 rounded-lg text-slate-300"
                  style={{ background: "#374151", border: "1px solid #4b5563" }}
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleSend(confirmPokemon)}
                  className="font-[family-name:var(--font-pixel)] text-[8px] px-4 py-2 rounded-lg text-white"
                  style={{ background: "#f97316", border: "1px solid #ea580c" }}
                >
                  Envoyer !
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg text-center"
            style={{
              background: "rgba(15,23,42,0.97)",
              border: "1px solid #f97316",
              boxShadow: "0 0 16px rgba(249,115,22,0.3)",
              maxWidth: "260px",
            }}
          >
            <p className="font-[family-name:var(--font-pixel)] text-[8px] text-orange-300">
              {toast}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
