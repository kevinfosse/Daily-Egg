"use client";
import { useState, useEffect, useCallback } from "react";

const SLOT_SYMBOLS = [
  { id: "downgrade", label: "Downgrade", probability: 20, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dusk-ball.png" },
  { id: "same", label: "Échange", probability: 42, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png" },
  { id: "upgrade", label: "Upgrade !", probability: 25, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png" },
  { id: "ticket", label: "Ticket !", probability: 8, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png" },
  { id: "egg", label: "ŒUF BONUS !", probability: 2, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lucky-egg.png" },
  { id: "item", label: "Objet !", probability: 3, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png" },
];

const ITEM_LABELS: Record<string, string> = {
  incense_rare: "Encens Rare 🌿",
  incense_epic: "Encens Épique 🔮",
  rare_candy: "Bonbon Rare 🍭",
  amulet_coin: "Amulette Pièce 💰",
  macho_brace: "Bracelet Bras 💪",
  lum_berry: "Baie Lum 🍒",
};

const createReelSymbols = () => {
  const symbols = [];
  for (let i = 0; i < 20; i++) {
    symbols.push(...SLOT_SYMBOLS);
  }
  return symbols;
};

const REEL_SYMBOLS = createReelSymbols();
const SYMBOL_HEIGHT = 80;

interface Pokemon {
  pokedexId: number;
  name: string;
  types: string[];
  sprite: string;
  isShiny: boolean;
  rarity: string;
  count: number;
}

interface ChanceWheelProps {
  isOpen: boolean;
  onClose: () => void;
  onSpinComplete?: (updates: { mysteryTickets: number; bonusEggs: number }) => void;
}

export default function ChanceWheel({ isOpen, onClose, onSpinComplete }: ChanceWheelProps) {
  const [loading, setLoading] = useState(false);
  const [canSpin, setCanSpin] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [timeUntilNext, setTimeUntilNext] = useState("");

  const [mysteryTickets, setMysteryTickets] = useState(0);
  const [bonusEggs, setBonusEggs] = useState(0);
  const [pokemons, setPokemons] = useState<Pokemon[]>([]);

  const [selectedPokemon, setSelectedPokemon] = useState<Pokemon | null>(null);
  const [showPokemonPicker, setShowPokemonPicker] = useState(false);

  const [reelOffset, setReelOffset] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [itemReceived, setItemReceived] = useState<string | null>(null);

  const fetchSpinStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/spin");
      const data = await res.json();
      if (data.success) {
        setCanSpin(data.data.canSpin);
        setMysteryTickets(data.data.mysteryTickets);
        setBonusEggs(data.data.bonusEggs);
        setPokemons(data.data.pokemons.filter((p: Pokemon) => p.rarity !== "legendary"));
      }
    } catch (error) {
      console.error("Erreur fetch spin status:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setResult(null);
    setSelectedPokemon(null);
    fetchSpinStatus();
  }, [isOpen, fetchSpinStatus]);

  // Countdown
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeUntilNext(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const spin = async () => {
    if (spinning || !canSpin || !selectedPokemon) return;
    setSpinning(true);
    setResult(null);
    try {
      const res = await fetch("/api/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pokedexId: selectedPokemon.pokedexId, isShiny: selectedPokemon.isShiny }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error);
        setSpinning(false);
        return;
      }

      // Animer la roue
      const resultType = data.data.result.type;
      const targetIndex = REEL_SYMBOLS.findIndex((s, i) => s.id === resultType && i > REEL_SYMBOLS.length - 15);
      setReelOffset(targetIndex * SYMBOL_HEIGHT);

      setTimeout(() => {
        setSpinning(false);
        setResult(data.data.result);
        setItemReceived(data.data.itemReceived ?? null);
        setCanSpin(false);
        setMysteryTickets(data.data.mysteryTickets);
        setBonusEggs(data.data.bonusEggs);
        setSelectedPokemon(null);
        if (onSpinComplete) {
          onSpinComplete({ mysteryTickets: data.data.mysteryTickets, bonusEggs: data.data.bonusEggs });
        }
        fetchSpinStatus();
      }, 3000);
    } catch (error) {
      console.error("Erreur spin:", error);
      setSpinning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/70" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-start overflow-y-auto py-8 px-4 gap-6"
        role="dialog"
        aria-label="Roue de la chance"
      >
        {/* Bouton fermer */}
        <div className="w-full max-w-sm flex justify-end">
          <button
            onClick={onClose}
            className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-600"
          >
            FERMER ✕
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && (
          <>
            {/* Header avec compteurs */}
            <div className="flex gap-4">
              <div className="flex items-center gap-2 bg-slate-800 border-2 border-yellow-500/50 rounded-lg px-4 py-2">
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png" alt="Ticket" className="w-8 h-8" />
                <span className="text-yellow-400 font-bold">{mysteryTickets}</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-800 border-2 border-purple-500/50 rounded-lg px-4 py-2">
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lucky-egg.png" alt="Œuf" className="w-8 h-8" />
                <span className="text-purple-400 font-bold">{bonusEggs}</span>
              </div>
            </div>

            {/* Pokémon sélectionné */}
            {selectedPokemon && (
              <div className="flex items-center gap-3 bg-slate-800 rounded-lg px-4 py-2 border border-red-500/50">
                <span className="text-slate-400 text-sm">Sacrifice :</span>
                <img src={selectedPokemon.sprite} alt={selectedPokemon.name} className="w-10 h-10" />
                <span className="text-white font-medium">{selectedPokemon.name}</span>
                {selectedPokemon.isShiny && <span className="text-yellow-400">✨</span>}
                <button onClick={() => setSelectedPokemon(null)} className="text-red-400 hover:text-red-300 ml-2">✕</button>
              </div>
            )}

            {/* Machine à sous */}
            <div className="relative bg-gradient-to-b from-red-700 to-red-900 rounded-2xl p-6 border-4 border-yellow-500 shadow-2xl">
              <div className="text-center mb-4">
                <h2 className="text-yellow-400 font-bold tracking-wider" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "12px" }}>
                  POKÉ CHANCE
                </h2>
              </div>

              {/* Fenêtre slot */}
              <div className="relative bg-slate-900 rounded-xl p-2 border-4 border-slate-600 overflow-hidden">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-12 bg-yellow-400 rounded-r z-10" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-12 bg-yellow-400 rounded-l z-10" />
                <div className="relative overflow-hidden bg-white rounded-lg" style={{ height: `${SYMBOL_HEIGHT * 3}px`, width: "200px" }}>
                  <div
                    className="absolute w-full"
                    style={{
                      transform: `translateY(-${reelOffset}px)`,
                      transition: spinning ? "transform 3s cubic-bezier(0.15, 0.85, 0.25, 1)" : "none",
                    }}
                  >
                    {REEL_SYMBOLS.map((symbol, index) => (
                      <div key={index} className="flex items-center justify-center" style={{ height: `${SYMBOL_HEIGHT}px` }}>
                        <img src={symbol.sprite} alt={symbol.label} className="w-16 h-16 object-contain" style={{ imageRendering: "pixelated" }} />
                      </div>
                    ))}
                  </div>
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/30 via-transparent to-black/30" />
                  <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-20 border-y-2 border-yellow-400/50 pointer-events-none" />
                </div>
              </div>

              {/* Boutons */}
              <div className="mt-6 flex flex-col items-center gap-3">
                {canSpin ? (
                  <>
                    {!selectedPokemon ? (
                      <button
                        onClick={() => setShowPokemonPicker(true)}
                        className="px-6 py-3 rounded-full font-bold bg-blue-500 border-4 border-b-8 border-blue-700 text-white hover:bg-blue-400 active:border-b-4 active:translate-y-1 transition-all"
                        style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px" }}
                      >
                        CHOISIR POKÉMON
                      </button>
                    ) : (
                      <button
                        onClick={spin}
                        disabled={spinning}
                        className={`px-8 py-4 rounded-full font-bold border-4 border-b-8 active:border-b-4 active:translate-y-1 transition-all
                          ${spinning ? "bg-gray-500 border-gray-700 text-gray-300 cursor-not-allowed" : "bg-green-500 border-green-700 text-white hover:bg-green-400"}
                        `}
                        style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}
                      >
                        {spinning ? "..." : "SPIN !"}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-center">
                    <p className="text-slate-400 mb-2" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "8px" }}>
                      PROCHAIN SPIN
                    </p>
                    <p className="text-yellow-400" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "16px" }}>
                      {timeUntilNext}
                    </p>
                  </div>
                )}
              </div>

              {/* Décorations */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <div className="w-16 h-6 bg-yellow-400 rounded-full border-2 border-yellow-600" />
              </div>
              <div className="absolute top-4 left-4 w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
              <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
            </div>

            {/* Légende */}
            <div className="grid grid-cols-6 gap-2">
              {SLOT_SYMBOLS.map((symbol) => (
                <div key={symbol.id} className="flex flex-col items-center gap-1">
                  <img src={symbol.sprite} alt={symbol.label} className="w-8 h-8" style={{ imageRendering: "pixelated" }} />
                  <span className="text-[9px] text-slate-400 text-center">{symbol.probability}%</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Modal sélection Pokémon */}
        {showPokemonPicker && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-60 p-4">
            <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
                  SACRIFIER UN POKÉMON
                </h3>
                <button onClick={() => setShowPokemonPicker(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
              </div>
              <p className="text-slate-400 text-xs mb-4">Les Légendaires ne peuvent pas être sacrifiés.</p>
              <div className="overflow-y-auto flex-1 grid grid-cols-3 gap-2">
                {pokemons.map((pokemon, index) => (
                  <button
                    key={`${pokemon.pokedexId}-${pokemon.isShiny}-${index}`}
                    onClick={() => { setSelectedPokemon(pokemon); setShowPokemonPicker(false); }}
                    className="flex flex-col items-center p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                  >
                    <div className="relative">
                      <img src={pokemon.sprite} alt={pokemon.name} className="w-12 h-12" />
                      {pokemon.isShiny && <span className="absolute -top-1 -right-1 text-yellow-400 text-xs">✨</span>}
                    </div>
                    <span className="text-white text-xs truncate w-full text-center">{pokemon.name}</span>
                    <span className="text-slate-400 text-xs">x{pokemon.count}</span>
                  </button>
                ))}
              </div>
              {pokemons.length === 0 && (
                <p className="text-slate-400 text-center py-8">Aucun Pokémon disponible</p>
              )}
            </div>
          </div>
        )}

        {/* Modal résultat */}
        {result && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-60 p-4">
            <div className={`bg-slate-800 rounded-2xl p-8 text-center max-w-sm border-4
              ${result.type === "egg" ? "border-purple-500" : ""}
              ${result.type === "ticket" ? "border-yellow-500" : ""}
              ${result.type === "upgrade" ? "border-green-500" : ""}
              ${result.type === "same" ? "border-blue-500" : ""}
              ${result.type === "downgrade" ? "border-red-500" : ""}
              ${result.type === "item" ? "border-indigo-500" : ""}
            `}>
              {result.newPokemon && (
                <>
                  <img src={result.newPokemon.sprite} alt={result.newPokemon.name} className="w-32 h-32 mx-auto mb-2" />
                  {result.newPokemon.isShiny && <p className="text-yellow-400 font-bold text-sm mb-2">✨ SHINY ✨</p>}
                  <h2 className="text-white text-xl font-bold">{result.newPokemon.name}</h2>
                  <p className={`text-sm font-medium mt-1
                    ${result.newRarity === "epic" ? "text-orange-400" : ""}
                    ${result.newRarity === "rare" ? "text-purple-400" : ""}
                    ${result.newRarity === "uncommon" ? "text-blue-400" : ""}
                    ${result.newRarity === "common" ? "text-green-400" : ""}
                  `}>
                    {result.newRarity?.toUpperCase()}
                  </p>
                </>
              )}

              {result.type === "ticket" && (
                <>
                  <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png" alt="Ticket" className="w-24 h-24 mx-auto mb-4" />
                  <h2 className="text-yellow-400 font-bold" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "14px" }}>
                    TICKET MYSTÈRE !
                  </h2>
                  <p className="text-slate-300 mt-2">Tu as maintenant {result.newTotal} ticket(s)</p>
                </>
              )}

              {result.type === "egg" && (
                <>
                  <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lucky-egg.png" alt="Œuf" className="w-24 h-24 mx-auto mb-4" />
                  <h2 className="text-purple-400 font-bold" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "14px" }}>
                    ŒUF BONUS !
                  </h2>
                  <p className="text-slate-300 mt-2">Tu as maintenant {result.newTotal} œuf(s) bonus</p>
                </>
              )}

              {result.type === "item" && (
                <>
                  <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png" alt="Objet" className="w-24 h-24 mx-auto mb-4" />
                  <h2 className="text-indigo-400 font-bold" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "14px" }}>
                    OBJET TROUVÉ !
                  </h2>
                  {itemReceived && (
                    <p className="text-slate-300 mt-2 text-sm">
                      Ajouté au sac : <span className="text-indigo-300 font-bold">{ITEM_LABELS[itemReceived] ?? itemReceived}</span>
                    </p>
                  )}
                </>
              )}

              <p className="text-slate-500 text-xs mt-4">{result.sacrificed?.name} a été sacrifié</p>

              <button
                onClick={() => setResult(null)}
                className="mt-6 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg font-bold"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
