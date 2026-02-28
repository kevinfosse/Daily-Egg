"use client";

import { useEffect, useState, useCallback } from "react";
import type { HatchedPokemon } from "@/app/types";

const ITEM_DEFS: Record<string, { name: string; emoji: string; sprite: string; description: string; type: "consumable" | "held" }> = {
  incense_rare: { name: "Encens Rare", emoji: "🌿", sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lax-incense.png", description: "Prochain œuf : rareté min = rare", type: "consumable" },
  incense_epic: { name: "Encens Épique", emoji: "🔮", sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sea-incense.png", description: "Prochain œuf : rareté min = épique", type: "consumable" },
  rare_candy: { name: "Bonbon Rare", emoji: "🍭", sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png", description: "Prochaine évolution gratuite", type: "consumable" },
  amulet_coin: { name: "Amulette Pièce", emoji: "💰", sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/amulet-coin.png", description: "×2 candy en expédition", type: "held" },
  macho_brace: { name: "Bracelet Bras", emoji: "💪", sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/macho-brace.png", description: "Garantit 1 Œuf Bonus (expédition)", type: "held" },
  lum_berry: { name: "Baie Lum", emoji: "🍒", sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lum-berry.png", description: "Réclamation 30 min plus tôt (expédition)", type: "held" },
};

interface InventoryItem {
  itemId: string;
  quantity: number;
}

interface BagProps {
  isOpen: boolean;
  onClose: () => void;
  onItemUsed: (updates: { nextEggMinRarity: string | null; freeEvolveReady: boolean; inventory: InventoryItem[] }) => void;
}

interface PokemonPickerProps {
  pokemons: HatchedPokemon[];
  itemId: string;
  onSelect: (p: HatchedPokemon) => void;
  onCancel: () => void;
}

function PokemonPicker({ pokemons, itemId, onSelect, onCancel }: PokemonPickerProps) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-slate-800 rounded-2xl p-5 max-w-sm w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            {ITEM_DEFS[itemId]?.sprite && (
              <img
                src={ITEM_DEFS[itemId].sprite}
                alt=""
                className="w-6 h-6"
                style={{ imageRendering: "pixelated" }}
              />
            )}
            <p className="font-[family-name:var(--font-pixel)] text-[9px] text-white">
              Équiper {ITEM_DEFS[itemId]?.name}
            </p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>
        <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 mb-3">
          Choisir un Pokémon (non en expédition)
        </p>
        <div className="overflow-y-auto flex-1 grid grid-cols-3 gap-2">
          {pokemons.map((p) => (
            <button
              key={`${p.pokedexId}-${p.isShiny}`}
              onClick={() => onSelect(p)}
              className="flex flex-col items-center p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
            >
              <div className="relative">
                <img src={p.sprite} alt={p.name} className="w-12 h-12 object-contain" style={{ imageRendering: "pixelated" }} />
                {p.isShiny && <span className="absolute -top-1 -right-1 text-yellow-400 text-xs">✨</span>}
                {p.equippedItem && ITEM_DEFS[p.equippedItem] && (
                  <img
                    src={ITEM_DEFS[p.equippedItem].sprite}
                    alt=""
                    className="absolute -bottom-1 -right-1 w-4 h-4"
                    style={{ imageRendering: "pixelated" }}
                  />
                )}
              </div>
              <span className="text-white text-[8px] truncate w-full text-center mt-1">{p.name}</span>
              {p.equippedItem && (
                <span className="text-slate-400 text-[7px]">{ITEM_DEFS[p.equippedItem]?.name}</span>
              )}
            </button>
          ))}
        </div>
        {pokemons.length === 0 && (
          <p className="text-slate-400 text-center py-6 font-[family-name:var(--font-pixel)] text-[8px]">
            Aucun Pokémon disponible
          </p>
        )}
      </div>
    </div>
  );
}

export default function Bag({ isOpen, onClose, onItemUsed }: BagProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [nextEggMinRarity, setNextEggMinRarity] = useState<string | null>(null);
  const [freeEvolveReady, setFreeEvolveReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [using, setUsing] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [unequipping, setUnequipping] = useState<string | null>(null);
  const [pickerItemId, setPickerItemId] = useState<string | null>(null);
  const [collection, setCollection] = useState<HatchedPokemon[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, colRes] = await Promise.all([
        fetch("/api/items"),
        fetch("/api/user/collection"),
      ]);
      const itemsData = await itemsRes.json();
      const colData = await colRes.json();
      setInventory(itemsData.inventory ?? []);
      setNextEggMinRarity(itemsData.nextEggMinRarity ?? null);
      setFreeEvolveReady(itemsData.freeEvolveReady ?? false);
      setCollection(colData.pokemons ?? colData.hatchedPokemon ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    load();
  }, [isOpen, load]);

  const handleUse = async (itemId: string) => {
    setUsing(itemId);
    try {
      const res = await fetch("/api/items/use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Erreur");
        return;
      }
      setInventory(data.inventory);
      setNextEggMinRarity(data.nextEggMinRarity ?? null);
      setFreeEvolveReady(data.freeEvolveReady ?? false);
      onItemUsed({ nextEggMinRarity: data.nextEggMinRarity, freeEvolveReady: data.freeEvolveReady, inventory: data.inventory });
      showToast(`${ITEM_DEFS[itemId]?.emoji} ${ITEM_DEFS[itemId]?.name} utilisé !`);
    } catch {
      showToast("Erreur réseau");
    } finally {
      setUsing(null);
    }
  };

  const handleEquip = async (itemId: string, pokemon: HatchedPokemon) => {
    setPickerItemId(null);
    setEquipping(itemId);
    try {
      const res = await fetch("/api/items/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, pokedexId: pokemon.pokedexId, isShiny: pokemon.isShiny }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Erreur");
        return;
      }
      setInventory(data.inventory);
      setCollection(data.pokemons);
      showToast(`${ITEM_DEFS[itemId]?.emoji} Équipé sur ${pokemon.name} !`);
    } catch {
      showToast("Erreur réseau");
    } finally {
      setEquipping(null);
    }
  };

  const handleUnequip = async (pokemon: HatchedPokemon) => {
    const key = `${pokemon.pokedexId}-${pokemon.isShiny}`;
    setUnequipping(key);
    try {
      const res = await fetch("/api/items/unequip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pokedexId: pokemon.pokedexId, isShiny: pokemon.isShiny }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Erreur");
        return;
      }
      setInventory(data.inventory);
      setCollection(data.pokemons);
      showToast(`Objet retiré de ${pokemon.name}`);
    } catch {
      showToast("Erreur réseau");
    } finally {
      setUnequipping(null);
    }
  };

  if (!isOpen) return null;

  const consumables = inventory.filter((i) => ITEM_DEFS[i.itemId]?.type === "consumable");
  const heldItems = inventory.filter((i) => ITEM_DEFS[i.itemId]?.type === "held");
  const equippedPokemons = collection.filter((p) => p.equippedItem);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70" onClick={onClose} aria-hidden="true" />

      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col overflow-y-auto"
        role="dialog"
        aria-label="Sac"
        style={{ background: "#1a0a2e", borderLeft: "2px solid #4c1d95" }}
      >
        {/* Header */}
        <div
          className="px-4 pt-4 pb-3 flex items-center justify-between sticky top-0 z-10"
          style={{ background: "#1a0a2e", borderBottom: "2px solid #4c1d95" }}
        >
          <h2 className="font-[family-name:var(--font-pixel)] text-sm text-purple-300">
            🎒 Sac
          </h2>
          <button
            onClick={onClose}
            className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 hover:text-white p-2"
          >
            FERMER
          </button>
        </div>

        <div className="p-4 flex flex-col gap-5">

          {loading && (
            <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-500 animate-pulse text-center py-8">
              Chargement...
            </p>
          )}

          {!loading && (
            <>
              {/* Effets actifs */}
              {(nextEggMinRarity || freeEvolveReady) && (
                <section>
                  <p className="font-[family-name:var(--font-pixel)] text-[8px] text-purple-400 mb-2">EFFETS ACTIFS</p>
                  <div className="flex flex-col gap-2">
                    {nextEggMinRarity && (
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ background: "rgba(124,58,237,0.15)", border: "1px solid #7c3aed" }}
                      >
                        <img
                          src={nextEggMinRarity === "epic"
                            ? "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/sea-incense.png"
                            : "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lax-incense.png"}
                          alt=""
                          className="w-7 h-7"
                          style={{ imageRendering: "pixelated" }}
                        />
                        <div>
                          <p className="font-[family-name:var(--font-pixel)] text-[8px] text-purple-300">
                            Encens actif
                          </p>
                          <p className="font-[family-name:var(--font-pixel)] text-[7px] text-slate-400">
                            Prochain œuf : min {nextEggMinRarity}
                          </p>
                        </div>
                      </div>
                    )}
                    {freeEvolveReady && (
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ background: "rgba(236,72,153,0.15)", border: "1px solid #ec4899" }}
                      >
                        <img
                          src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png"
                          alt=""
                          className="w-7 h-7"
                          style={{ imageRendering: "pixelated" }}
                        />
                        <div>
                          <p className="font-[family-name:var(--font-pixel)] text-[8px] text-pink-300">
                            Bonbon Rare actif
                          </p>
                          <p className="font-[family-name:var(--font-pixel)] text-[7px] text-slate-400">
                            Prochaine évolution gratuite
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Consommables */}
              <section>
                <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 mb-2">CONSOMMABLES</p>
                {consumables.length === 0 && (
                  <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-600">
                    Aucun consommable.
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {consumables.map((item) => {
                    const def = ITEM_DEFS[item.itemId];
                    if (!def) return null;
                    return (
                      <div
                        key={item.itemId}
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{ background: "rgba(30,41,59,0.8)", border: "1px solid #334155" }}
                      >
                        <img
                          src={def.sprite}
                          alt={def.name}
                          className="w-8 h-8 flex-shrink-0"
                          style={{ imageRendering: "pixelated" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-[family-name:var(--font-pixel)] text-[8px] text-white">
                            {def.name} <span className="text-slate-400">×{item.quantity}</span>
                          </p>
                          <p className="font-[family-name:var(--font-pixel)] text-[7px] text-slate-400 mt-0.5">
                            {def.description}
                          </p>
                        </div>
                        <button
                          onClick={() => handleUse(item.itemId)}
                          disabled={!!using}
                          className="font-[family-name:var(--font-pixel)] text-[8px] px-3 py-1.5 rounded-lg text-white disabled:opacity-50 flex-shrink-0"
                          style={{ background: "#7c3aed", border: "1px solid #6d28d9" }}
                        >
                          {using === item.itemId ? "..." : "Utiliser"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Objets tenus */}
              <section>
                <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 mb-2">OBJETS TENUS</p>
                {heldItems.length === 0 && (
                  <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-600">
                    Aucun objet tenu.
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {heldItems.map((item) => {
                    const def = ITEM_DEFS[item.itemId];
                    if (!def) return null;
                    return (
                      <div
                        key={item.itemId}
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{ background: "rgba(30,41,59,0.8)", border: "1px solid #334155" }}
                      >
                        <img
                          src={def.sprite}
                          alt={def.name}
                          className="w-8 h-8 flex-shrink-0"
                          style={{ imageRendering: "pixelated" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-[family-name:var(--font-pixel)] text-[8px] text-white">
                            {def.name} <span className="text-slate-400">×{item.quantity}</span>
                          </p>
                          <p className="font-[family-name:var(--font-pixel)] text-[7px] text-slate-400 mt-0.5">
                            {def.description}
                          </p>
                        </div>
                        <button
                          onClick={() => setPickerItemId(item.itemId)}
                          disabled={!!equipping || !!pickerItemId}
                          className="font-[family-name:var(--font-pixel)] text-[8px] px-3 py-1.5 rounded-lg text-white disabled:opacity-50 flex-shrink-0"
                          style={{ background: "#0ea5e9", border: "1px solid #0284c7" }}
                        >
                          {equipping === item.itemId ? "..." : "Équiper"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Pokémon équipés */}
              {equippedPokemons.length > 0 && (
                <section>
                  <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 mb-2">ÉQUIPÉS</p>
                  <div className="flex flex-col gap-2">
                    {equippedPokemons.map((p) => {
                      const key = `${p.pokedexId}-${p.isShiny}`;
                      const itemDef = p.equippedItem ? ITEM_DEFS[p.equippedItem] : null;
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-3 p-3 rounded-lg"
                          style={{ background: "rgba(30,41,59,0.8)", border: "1px solid #334155" }}
                        >
                          <img
                            src={p.sprite}
                            alt={p.name}
                            className="w-10 h-10 object-contain flex-shrink-0"
                            style={{ imageRendering: "pixelated" }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-[family-name:var(--font-pixel)] text-[8px] text-white truncate">
                              {p.name} {p.isShiny && <span className="text-yellow-400">★</span>}
                            </p>
                            {itemDef && (
                              <p className="font-[family-name:var(--font-pixel)] text-[7px] text-slate-400 mt-0.5 flex items-center gap-1">
                                <img
                                  src={itemDef.sprite}
                                  alt=""
                                  className="w-4 h-4 inline-block"
                                  style={{ imageRendering: "pixelated" }}
                                />
                                {itemDef.name}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleUnequip(p)}
                            disabled={unequipping === key}
                            className="font-[family-name:var(--font-pixel)] text-[8px] px-3 py-1.5 rounded-lg text-white disabled:opacity-50 flex-shrink-0"
                            style={{ background: "#dc2626", border: "1px solid #b91c1c" }}
                          >
                            {unequipping === key ? "..." : "Retirer"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg text-center"
            style={{
              background: "rgba(26,10,46,0.97)",
              border: "1px solid #7c3aed",
              boxShadow: "0 0 16px rgba(124,58,237,0.4)",
              maxWidth: "280px",
            }}
          >
            <p className="font-[family-name:var(--font-pixel)] text-[8px] text-purple-300">{toast}</p>
          </div>
        )}
      </div>

      {/* Pokemon picker modal */}
      {pickerItemId && (
        <PokemonPicker
          pokemons={collection}
          itemId={pickerItemId}
          onSelect={(p) => handleEquip(pickerItemId, p)}
          onCancel={() => setPickerItemId(null)}
        />
      )}
    </>
  );
}
