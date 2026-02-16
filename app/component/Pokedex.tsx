"use client";

import { useEffect, useMemo, useState } from "react";
import type { HatchedPokemon } from "@/app/types";
import { loadGuestState } from "@/app/lib/guest/storage";

interface PokedexProps {
  isOpen: boolean;
  onClose: () => void;
  isGuest?: boolean;
}

export default function Pokedex({ isOpen, onClose, isGuest }: PokedexProps) {
  const [pokemons, setPokemons] = useState<HatchedPokemon[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPokemon, setSelectedPokemon] = useState<HatchedPokemon | null>(null);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [shinyOnly, setShinyOnly] = useState(false);

  const normalizedQuery = search.trim().toLowerCase();
  const filteredPokemons = useMemo(() => {
    const q = normalizedQuery;
    const base = pokemons.filter((p) => {
      if (shinyOnly && !p.isShiny) return false;
      if (!q) return true;
      const nameMatch = (p.name ?? "").toLowerCase().includes(q);
      const idMatch = String(p.pokedexId ?? "").includes(q);
      const typeMatch = (p.types ?? []).some((t) => String(t).toLowerCase().includes(q));
      return nameMatch || idMatch || typeMatch;
    });

    const dir = sortOrder === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      const aId = typeof a.pokedexId === "number" ? a.pokedexId : Number(a.pokedexId ?? 0);
      const bId = typeof b.pokedexId === "number" ? b.pokedexId : Number(b.pokedexId ?? 0);
      return (aId - bId) * dir;
    });
  }, [pokemons, normalizedQuery, sortOrder, shinyOnly]);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);
    setSelectedPokemon(null);

    if (isGuest) {
      const guest = loadGuestState();
      setPokemons((guest?.pokemons as HatchedPokemon[]) ?? []);
      setLoading(false);
      return;
    }

    fetch("/api/user/collection")
      .then((res) => {
        if (!res.ok) throw new Error("Erreur lors du chargement");
        return res.json();
      })
      .then((data) => {
        setPokemons(data.pokemons ?? data.hatchedPokemon ?? []);
      })
      .catch(() => setError("Impossible de charger la collection"))
      .finally(() => setLoading(false));
  }, [isOpen, isGuest]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/70"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Pokédex */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col"
        role="dialog"
        aria-label="Pokédex"
        style={{ background: "#c62828" }}
      >
        {/* Header - coque du Pokédex */}
        <div className="px-4 pt-4 pb-3">
          {/* LEDs */}
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-5 h-5 rounded-full"
              style={{
                background: "radial-gradient(circle at 35% 35%, #b3e5fc, #0288d1)",
                border: "2px solid #01579b",
                boxShadow: "0 0 8px rgba(2, 136, 209, 0.6)",
              }}
            />
            <div className="w-2.5 h-2.5 rounded-full bg-red-400 border border-red-600" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 border border-yellow-600" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400 border border-green-600" />
          </div>

          <div className="flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-pixel)] text-sm text-white">
              Pokédex
            </h2>
            <button
              onClick={onClose}
              className="font-[family-name:var(--font-pixel)] text-[8px] text-red-200 hover:text-white p-2"
            >
              FERMER
            </button>
          </div>
        </div>

        {/* Écran - style LCD vert du Pokédex */}
        <div
          className="flex-1 mx-3 mb-3 flex flex-col overflow-hidden"
          style={{
            background: "#1a2332",
            border: "3px solid #0d1520",
            boxShadow: "inset 0 2px 8px rgba(0,0,0,0.6), 0 2px 0 #e53935",
            borderRadius: "4px",
          }}
        >
          {/* Barre de titre de l'écran */}
          <div
            className="px-3 py-2 flex items-center justify-between"
            style={{
              background: "#0d1520",
              borderBottom: "2px solid #2a3a4e",
            }}
          >
            <p className="font-[family-name:var(--font-pixel)] text-[8px] text-cyan-400">
              {selectedPokemon
                ? `N°${String(selectedPokemon.pokedexId).padStart(3, "0")}`
                : normalizedQuery
                ? `${filteredPokemons.length} / ${pokemons.length} CAPTURES`
                : `${pokemons.length} CAPTURES`}
            </p>
            <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-500">
              POKEDEX v1.0
            </p>
          </div>

          {/* Détail Pokémon sélectionné */}
          {selectedPokemon && (
            <div className="p-4" style={{ borderBottom: "1px solid #2a3a4e" }}>
              <button
                onClick={() => setSelectedPokemon(null)}
                className="font-[family-name:var(--font-pixel)] text-[8px] text-cyan-400 hover:text-cyan-300 mb-3"
              >
                &lt; RETOUR
              </button>
              <div className="flex items-center gap-4">
                <div
                  className="p-2"
                  style={{
                    background: "#0d1520",
                    border: "2px solid #2a3a4e",
                    borderRadius: "4px",
                  }}
                >
                  <img
                    src={selectedPokemon.sprite}
                    alt={selectedPokemon.name}
                    className="w-24 h-24 object-contain"
                  />
                </div>
                <div>
                  <p className="font-[family-name:var(--font-pixel)] text-xs text-white">
                    {selectedPokemon.name}
                  </p>
                  {selectedPokemon.isShiny && (
                    <p className="font-[family-name:var(--font-pixel)] text-[8px] text-yellow-400 mt-1">
                      SHINY
                    </p>
                  )}
                  <p
                    className="font-[family-name:var(--font-pixel)] text-[8px] mt-1"
                    style={{ color: getRarityColor(selectedPokemon.rarity) }}
                  >
                    {selectedPokemon.rarity.toUpperCase()}
                  </p>
                  <div className="flex gap-1 mt-2">
                    {selectedPokemon.types.map((type) => (
                      <span
                        key={type}
                        className="px-2 py-0.5 text-[9px] font-medium text-white"
                        style={{
                          backgroundColor: getTypeColor(type),
                          borderRadius: "3px",
                        }}
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                  {selectedPokemon.count > 1 && (
                    <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 mt-2">
                      Obtenu x{selectedPokemon.count}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Grille */}
          <div className="flex-1 overflow-y-auto p-3">
            {/* Recherche */}
            <div className="mb-3">
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{
                  background: "#0d1520",
                  border: "1px solid #2a3a4e",
                  borderRadius: "4px",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                  overflow: "hidden",
                }}
              >
                <span
                  className="font-[family-name:var(--font-pixel)] text-[8px]"
                  style={{ color: "#22d3ee" }}
                  aria-hidden="true"
                >
                  RECH
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setSearch("");
                  }}
                  placeholder="Nom, N°, type..."
                  disabled={loading}
                  spellCheck={false}
                  autoComplete="off"
                  inputMode="search"
                  aria-label="Rechercher un Pokémon"
                  className="flex-1 min-w-0 bg-transparent outline-none font-[family-name:var(--font-pixel)] text-[9px] text-slate-200 placeholder:text-slate-500"
                />

                {/* Tri (droite) */}
                <button
                  type="button"
                  onClick={() => setSortOrder((v) => (v === "asc" ? "desc" : "asc"))}
                  disabled={loading}
                  aria-label={`Trier par numéro ${sortOrder === "asc" ? "ascendant" : "descendant"}`}
                  className="font-[family-name:var(--font-pixel)] text-[8px]"
                  style={{
                    border: "1px solid #2a3a4e",
                    borderRadius: "3px",
                    padding: "4px 6px",
                    background: "rgba(13, 21, 32, 0.6)",
                    color: "#94a3b8",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {sortOrder === "asc" ? "ASC" : "DESC"}
                </button>

                {/* Filtre shiny (*) */}
                <button
                  type="button"
                  onClick={() => setShinyOnly((v) => !v)}
                  disabled={loading}
                  aria-pressed={shinyOnly}
                  aria-label={shinyOnly ? "Afficher tous les Pokémon" : "Afficher uniquement les shiny"}
                  className="font-[family-name:var(--font-pixel)] text-[10px]"
                  style={{
                    border: "1px solid",
                    borderColor: shinyOnly ? "#f8d030" : "#2a3a4e",
                    borderRadius: "3px",
                    padding: "4px 8px",
                    background: shinyOnly ? "rgba(248, 208, 48, 0.12)" : "rgba(13, 21, 32, 0.6)",
                    color: shinyOnly ? "#f8d030" : "#94a3b8",
                    lineHeight: "10px",
                    flexShrink: 0,
                  }}
                >
                  *
                </button>
              </div>
              {normalizedQuery && !loading && !error && (
                <p className="mt-2 font-[family-name:var(--font-pixel)] text-[8px] text-slate-500">
                  {filteredPokemons.length} résultat{filteredPokemons.length > 1 ? "s" : ""}
                </p>
              )}
            </div>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <p className="font-[family-name:var(--font-pixel)] text-xs text-cyan-400 animate-pulse">
                  Chargement...
                </p>
              </div>
            )}

            {error && (
              <p className="font-[family-name:var(--font-pixel)] text-[8px] text-red-400 text-center py-12">
                {error}
              </p>
            )}

            {!loading && !error && pokemons.length === 0 && (
              <div className="py-12 text-center">
                <p className="font-[family-name:var(--font-pixel)] text-xs text-slate-400">
                  Collection vide
                </p>
                <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-500 mt-2">
                  Eclos des oeufs !
                </p>
              </div>
            )}

            {!loading && !error && pokemons.length > 0 && filteredPokemons.length === 0 && (
              <div className="py-10 text-center">
                <p className="font-[family-name:var(--font-pixel)] text-xs text-slate-300">
                  Aucun résultat
                </p>
                <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-500 mt-2">
                  Essaie un nom, un numéro ou un type.
                </p>
              </div>
            )}

            {!loading && !error && filteredPokemons.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {filteredPokemons.map((pokemon) => (
                  <button
                    key={`${pokemon.pokedexId}-${pokemon.isShiny}`}
                    onClick={() => setSelectedPokemon(pokemon)}
                    className="p-2 text-center transition-all hover:scale-105"
                    style={{
                      background:
                        selectedPokemon?.pokedexId === pokemon.pokedexId &&
                        selectedPokemon?.isShiny === pokemon.isShiny
                          ? "#2a3a4e"
                          : "transparent",
                      borderRadius: "4px",
                      border:
                        selectedPokemon?.pokedexId === pokemon.pokedexId &&
                        selectedPokemon?.isShiny === pokemon.isShiny
                          ? "1px solid #3a5068"
                          : "1px solid transparent",
                    }}
                  >
                    <img
                      src={pokemon.sprite}
                      alt={pokemon.name}
                      className="mx-auto h-14 w-14 object-contain"
                    />
                    <p className="font-[family-name:var(--font-pixel)] text-[7px] text-slate-300 mt-1 truncate">
                      {pokemon.name}
                    </p>
                    <p
                      className="text-[6px] font-medium mt-0.5"
                      style={{ color: getRarityColor(pokemon.rarity) }}
                    >
                      {pokemon.rarity.toUpperCase()}
                    </p>
                    {pokemon.isShiny && (
                      <p className="font-[family-name:var(--font-pixel)] text-[6px] text-yellow-400">
                        SHINY
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bas de la coque - boutons physiques */}
        <div className="px-4 pb-4 flex justify-center gap-4">
          <div
            className="w-10 h-10"
            style={{
              background: "#333",
              borderRadius: "50%",
              border: "2px solid #222",
              boxShadow: "inset 0 2px 4px rgba(255,255,255,0.1)",
            }}
          />
          <div
            className="w-10 h-10"
            style={{
              background: "#333",
              borderRadius: "50%",
              border: "2px solid #222",
              boxShadow: "inset 0 2px 4px rgba(255,255,255,0.1)",
            }}
          />
        </div>
      </div>
    </>
  );
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

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    normal: "#A8A77A",
    fire: "#EE8130",
    water: "#6390F0",
    electric: "#F7D02C",
    grass: "#7AC74C",
    ice: "#96D9D6",
    fighting: "#C22E28",
    poison: "#A33EA1",
    ground: "#E2BF65",
    flying: "#A98FF3",
    psychic: "#F95587",
    bug: "#A6B91A",
    rock: "#B6A136",
    ghost: "#735797",
    dragon: "#6F35FC",
    dark: "#705746",
    steel: "#B7B7CE",
    fairy: "#D685AD",
  };
  return colors[type] ?? "#777777";
}