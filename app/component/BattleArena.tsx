"use client";

import { useEffect, useState, useRef } from "react";
import { getEloRank } from "@/app/lib/pvp/elo";

interface BattleMove {
  name: string;
  power: number;
  type: string;
  category: "physical" | "special";
}

type BattleStatus = "none" | "burned" | "paralyzed";

interface BattleData {
  playerPokedexId: number;
  playerIsShiny: boolean;
  playerName: string;
  playerSprite: string;
  playerTypes: string[];
  playerHP: number;
  playerMaxHP: number;
  playerATK: number;
  playerDEF: number;
  playerMoves: BattleMove[];
  playerStatus: BattleStatus;
  enemyPokedexId: number;
  enemyName: string;
  enemySprite: string;
  enemyTypes: string[];
  enemyRarity: string;
  enemyHP: number;
  enemyMaxHP: number;
  enemyATK: number;
  enemyDEF: number;
  enemyMoves: BattleMove[];
  enemyStatus: BattleStatus;
  turn: number;
  log: string[];
  status: "active" | "won" | "lost";
  rewards?: { candy: number; itemDropped?: string; bonusExpedition: boolean; dailyBonus?: number };
  expiresAt: string;
}

interface CollectionPokemon {
  pokedexId: number;
  name: string;
  sprite: string;
  isShiny: boolean;
  rarity: string;
  types: string[];
  count: number;
  equippedItem?: string;
}

interface PvpOpponent {
  _id: string;
  username: string;
  pvpWins: number;
  pvpLosses: number;
  pvpElo?: number;
  pvpDefenseTeam: { name: string; sprite: string; rarity: string; types?: string[] }[];
}

interface PvpChallengeRecord {
  _id: string;
  challengerName: string;
  defenderName: string;
  result: "challenger" | "defender";
  log: string[];
  candyChallenger: number;
  candyDefender: number;
  createdAt: string;
}

interface FeaturedPokemon {
  id: number;
  name: string;
  sprite: string;
  types: string[];
  rarity: string;
}

interface BattleArenaProps {
  isOpen: boolean;
  onClose: () => void;
  dailyBattles: number;
  dailyChallengeWon: boolean;
  pvpWins: number;
  pvpLosses: number;
  dailyPvpChallenges: number;
  pvpElo: number;
  featuredPokemon: FeaturedPokemon | null;
  onBattleEnd: (updates: { candy: number; bonusExpeditionSlots: number; dailyChallengeWon?: boolean; pvpElo?: number }) => void;
}

const TYPE_COLORS: Record<string, string> = {
  normal: "#A8A77A", fire: "#EE8130", water: "#6390F0", electric: "#F7D02C",
  grass: "#7AC74C", ice: "#96D9D6", fighting: "#C22E28", poison: "#A33EA1",
  ground: "#E2BF65", flying: "#A98FF3", psychic: "#F95587", bug: "#A6B91A",
  rock: "#B6A136", ghost: "#735797", dragon: "#6F35FC", dark: "#705746",
  steel: "#B7B7CE", fairy: "#D685AD",
};

const RARITY_COLORS: Record<string, string> = {
  common: "#78C850", uncommon: "#6890F0", rare: "#A040A0",
  epic: "#F08030", legendary: "#F8D030",
};

function HPBar({ current, max, color }: { current: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const barColor = pct > 50 ? "#22c55e" : pct > 25 ? "#f59e0b" : "#ef4444";
  return (
    <div className="w-full">
      <div className="flex justify-between mb-0.5">
        <span className="font-[family-name:var(--font-pixel)] text-[8px]" style={{ color }}>HP</span>
        <span className="font-[family-name:var(--font-pixel)] text-[8px] text-white">{current}/{max}</span>
      </div>
      <div className="w-full h-2 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: BattleStatus }) {
  if (!status || status === "none") return null;
  return (
    <span
      className="font-[family-name:var(--font-pixel)] text-[9px] px-1 rounded ml-1"
      style={{
        background: status === "burned" ? "rgba(239,68,68,0.3)" : "rgba(250,204,21,0.3)",
        color: status === "burned" ? "#f97316" : "#eab308",
        border: `1px solid ${status === "burned" ? "#f97316" : "#eab308"}`,
      }}
    >
      {status === "burned" ? "🔥" : "⚡"}
    </span>
  );
}

function LogLine({ line }: { line: string }) {
  const isCrit = line.includes("Coup critique");
  const isDailyBonus = line.includes("Défi Quotidien");
  return (
    <p
      className="font-[family-name:var(--font-pixel)] text-[8px] leading-relaxed"
      style={{
        color: isCrit ? "#facc15" : isDailyBonus ? "#a78bfa" : "#cbd5e1",
        fontWeight: isCrit || isDailyBonus ? "bold" : "normal",
      }}
    >
      {line}
    </p>
  );
}

export default function BattleArena({
  isOpen, onClose, dailyBattles, dailyChallengeWon, pvpWins, pvpLosses,
  dailyPvpChallenges, pvpElo, featuredPokemon, onBattleEnd,
}: BattleArenaProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<"pve" | "pvp">("pve");

  // PvE state
  const [phase, setPhase] = useState<"select" | "battle" | "result">("select");
  const [collection, setCollection] = useState<CollectionPokemon[]>([]);
  const [expeditions, setExpeditions] = useState<{ pokedexId: number; isShiny: boolean }[]>([]);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [selectedPokemon, setSelectedPokemon] = useState<CollectionPokemon | null>(null);
  const [battle, setBattle] = useState<BattleData | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [playerShake, setPlayerShake] = useState(false);
  const [enemyShake, setEnemyShake] = useState(false);
  const [battlesUsed, setBattlesUsed] = useState(dailyBattles);
  const [localChallengeWon, setLocalChallengeWon] = useState(dailyChallengeWon);
  const logRef = useRef<HTMLDivElement>(null);

  // PvP state
  const [pvpPhase, setPvpPhase] = useState<"menu" | "defense" | "challenge" | "result" | "history">("menu");
  const [pvpCollection, setPvpCollection] = useState<CollectionPokemon[]>([]);
  const [defenseTeam, setDefenseTeam] = useState<any[]>([]);
  const [loadingDefense, setLoadingDefense] = useState(false);
  const [selectedDefense, setSelectedDefense] = useState<CollectionPokemon[]>([]);
  const [opponents, setOpponents] = useState<PvpOpponent[]>([]);
  const [loadingOpponents, setLoadingOpponents] = useState(false);
  const [pvpAttacker, setPvpAttacker] = useState<CollectionPokemon | null>(null);
  const [selectedOpponent, setSelectedOpponent] = useState<PvpOpponent | null>(null);
  const [pvpResult, setPvpResult] = useState<{ result: string; log: string[]; candyEarned: number } | null>(null);
  const [pvpHistory, setPvpHistory] = useState<PvpChallengeRecord[]>([]);
  const [pvpWinsLocal, setPvpWinsLocal] = useState(pvpWins);
  const [pvpLossesLocal, setPvpLossesLocal] = useState(pvpLosses);
  const [pvpChallengesUsed, setPvpChallengesUsed] = useState(dailyPvpChallenges);
  const [pvpEloLocal, setPvpEloLocal] = useState(pvpElo);
  const [pvpEloChange, setPvpEloChange] = useState<number | null>(null);
  const [loadingPvp, setLoadingPvp] = useState(false);
  const [pvpExpeditions, setPvpExpeditions] = useState<{ pokedexId: number; isShiny: boolean }[]>([]);

  useEffect(() => { setBattlesUsed(dailyBattles); }, [dailyBattles]);
  useEffect(() => { setLocalChallengeWon(dailyChallengeWon); }, [dailyChallengeWon]);
  useEffect(() => { setPvpWinsLocal(pvpWins); }, [pvpWins]);
  useEffect(() => { setPvpLossesLocal(pvpLosses); }, [pvpLosses]);
  useEffect(() => { setPvpChallengesUsed(dailyPvpChallenges); }, [dailyPvpChallenges]);
  useEffect(() => { setPvpEloLocal(pvpElo); }, [pvpElo]);

  // Load collection when opening
  useEffect(() => {
    if (!isOpen) return;
    setPhase("select");
    setBattle(null);
    setSelectedPokemon(null);
    setLoadingCollection(true);
    setActiveTab("pve");

    Promise.all([
      fetch("/api/user/collection").then((r) => r.json()),
      fetch("/api/expeditions").then((r) => r.json()),
    ])
      .then(([colData, expData]) => {
        setCollection(colData.pokemons ?? []);
        const exps = (expData.expeditions ?? []).map((e: any) => ({
          pokedexId: e.pokedexId,
          isShiny: e.isShiny,
        }));
        setExpeditions(exps);
        setPvpExpeditions(exps);
        setPvpCollection(colData.pokemons ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingCollection(false));
  }, [isOpen]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [battle?.log]);

  // Load defense team and opponents when switching to PvP
  useEffect(() => {
    if (activeTab !== "pvp") return;
    setLoadingDefense(true);
    fetch("/api/pvp/defense")
      .then((r) => r.json())
      .then((data) => setDefenseTeam(data.defenseTeam ?? []))
      .catch(() => {})
      .finally(() => setLoadingDefense(false));
  }, [activeTab]);

  const loadOpponents = () => {
    setLoadingOpponents(true);
    fetch("/api/pvp/opponents")
      .then((r) => r.json())
      .then((data) => setOpponents(data.opponents ?? []))
      .catch(() => {})
      .finally(() => setLoadingOpponents(false));
  };

  const loadHistory = () => {
    fetch("/api/pvp/challenge")
      .then((r) => r.json())
      .then((data) => setPvpHistory(data.challenges ?? []))
      .catch(() => {});
  };

  const handleSelectPokemon = async (pokemon: CollectionPokemon) => {
    if (battlesUsed >= 3) return;
    setLoadingAction(true);
    try {
      const res = await fetch("/api/battle/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pokedexId: pokemon.pokedexId, isShiny: pokemon.isShiny }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Erreur lors du démarrage du combat");
        return;
      }
      setBattle(data.battle);
      setBattlesUsed(data.dailyBattles);
      setSelectedPokemon(pokemon);
      setPhase("battle");
    } catch {
      alert("Erreur réseau");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleMove = async (moveIndex: number) => {
    if (!battle || battle.status !== "active" || loadingAction) return;
    setLoadingAction(true);

    try {
      const res = await fetch("/api/battle/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moveIndex }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Erreur");
        return;
      }

      const newBattle: BattleData = data.battle;

      if (battle.enemyHP !== newBattle.enemyHP) {
        setEnemyShake(true);
        setTimeout(() => setEnemyShake(false), 400);
      }
      if (battle.playerHP !== newBattle.playerHP) {
        setPlayerShake(true);
        setTimeout(() => setPlayerShake(false), 400);
      }

      setBattle(newBattle);

      if (newBattle.status !== "active") {
        setPhase("result");
        if (newBattle.status === "won" && newBattle.rewards) {
          if (newBattle.rewards.dailyBonus) setLocalChallengeWon(true);
          const userRes = await fetch("/api/user");
          const userData = await userRes.json();
          onBattleEnd({
            candy: userData.candy ?? 0,
            bonusExpeditionSlots: userData.bonusExpeditionSlots ?? 0,
            dailyChallengeWon: userData.dailyChallengeWon ?? localChallengeWon,
          });
        }
      }
    } catch {
      alert("Erreur réseau");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleClose = () => {
    setPhase("select");
    setBattle(null);
    setSelectedPokemon(null);
    setPvpPhase("menu");
    setPvpResult(null);
    setPvpEloChange(null);
    setSelectedOpponent(null);
    setPvpAttacker(null);
    onClose();
  };

  // PvP: save defense team
  const handleSaveDefense = async () => {
    if (selectedDefense.length === 0) return;
    setLoadingPvp(true);
    try {
      const res = await fetch("/api/pvp/defense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pokemons: selectedDefense.map((p) => ({ pokedexId: p.pokedexId, isShiny: p.isShiny })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "Erreur"); return; }
      setDefenseTeam(data.defenseTeam ?? []);
      setSelectedDefense([]);
      setPvpPhase("menu");
    } catch {
      alert("Erreur réseau");
    } finally {
      setLoadingPvp(false);
    }
  };

  // PvP: send challenge
  const handleChallenge = async () => {
    if (!selectedOpponent || !pvpAttacker) return;
    if (pvpChallengesUsed >= 5) return;
    setLoadingPvp(true);
    try {
      const res = await fetch("/api/pvp/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defenderId: selectedOpponent._id,
          attackerPokedexId: pvpAttacker.pokedexId,
          attackerIsShiny: pvpAttacker.isShiny,
        }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "Erreur"); return; }
      setPvpResult(data);
      setPvpChallengesUsed((prev) => prev + 1);
      if (data.result === "challenger") {
        setPvpWinsLocal((prev) => prev + 1);
      } else {
        setPvpLossesLocal((prev) => prev + 1);
      }
      if (data.newElo !== undefined) {
        setPvpEloChange(data.eloChange ?? null);
        setPvpEloLocal(data.newElo);
      }
      // Refresh user candy
      const userRes = await fetch("/api/user");
      const userData = await userRes.json();
      onBattleEnd({
        candy: userData.candy ?? 0,
        bonusExpeditionSlots: userData.bonusExpeditionSlots ?? 0,
        pvpElo: data.newElo ?? pvpEloLocal,
      });
      setPvpPhase("result");
    } catch {
      alert("Erreur réseau");
    } finally {
      setLoadingPvp(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl flex flex-col"
        style={{
          background: "linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)",
          border: "1px solid rgba(99,102,241,0.3)",
          maxHeight: "90vh",
          animation: "slideUp 0.3s ease-out",
        }}
      >
        {/* Header with tabs */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("pve")}
              className="font-[family-name:var(--font-pixel)] text-[9px] px-2 py-1 rounded transition-colors"
              style={{
                background: activeTab === "pve" ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${activeTab === "pve" ? "#6366f1" : "rgba(255,255,255,0.1)"}`,
                color: activeTab === "pve" ? "#a5b4fc" : "#64748b",
              }}
            >
              ⚔️ PvE ({battlesUsed}/3)
            </button>
            <button
              onClick={() => setActiveTab("pvp")}
              className="font-[family-name:var(--font-pixel)] text-[9px] px-2 py-1 rounded transition-colors"
              style={{
                background: activeTab === "pvp" ? "rgba(234,179,8,0.3)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${activeTab === "pvp" ? "#eab308" : "rgba(255,255,255,0.1)"}`,
                color: activeTab === "pvp" ? "#fde047" : "#64748b",
              }}
            >
              🏆 PvP ({pvpChallengesUsed}/5)
            </button>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">

          {/* =================== PvE TAB =================== */}
          {activeTab === "pve" && (
            <>
              {/* Daily challenge banner */}
              {!localChallengeWon && featuredPokemon && phase === "select" && (
                <div
                  className="mb-3 px-3 py-2 rounded-lg flex items-center gap-2"
                  style={{ background: "rgba(99,102,241,0.15)", border: "1px solid #6366f1" }}
                >
                  <span className="text-base">🌟</span>
                  <p className="font-[family-name:var(--font-pixel)] text-[8px] text-indigo-300 leading-tight">
                    Défi du Jour : battez un Pokémon{" "}
                    {featuredPokemon.types.map((t) => (
                      <span key={t} className="font-bold" style={{ color: TYPE_COLORS[t] ?? "#fff" }}>[{t}]</span>
                    ))}{" "}
                    pour +50 🍬
                  </p>
                </div>
              )}
              {localChallengeWon && phase === "select" && (
                <div
                  className="mb-3 px-3 py-2 rounded-lg"
                  style={{ background: "rgba(34,197,94,0.12)", border: "1px solid #22c55e" }}
                >
                  <p className="font-[family-name:var(--font-pixel)] text-[8px] text-green-400">
                    ✅ Défi Quotidien accompli !
                  </p>
                </div>
              )}

              {/* Phase: Select */}
              {phase === "select" && (
                <>
                  {battlesUsed >= 3 ? (
                    <div className="text-center py-8">
                      <p className="font-[family-name:var(--font-pixel)] text-sm text-red-400">Limite de combats atteinte !</p>
                      <p className="font-[family-name:var(--font-pixel)] text-[9px] text-slate-400 mt-2">Revenez demain.</p>
                    </div>
                  ) : (
                    <>
                      <p className="font-[family-name:var(--font-pixel)] text-[9px] text-slate-300 mb-3">
                        Choisissez un Pokémon pour combattre :
                      </p>
                      {loadingCollection ? (
                        <p className="font-[family-name:var(--font-pixel)] text-[9px] text-slate-400 text-center py-4 animate-pulse">Chargement...</p>
                      ) : collection.length === 0 ? (
                        <p className="font-[family-name:var(--font-pixel)] text-[9px] text-slate-400 text-center py-4">Aucun Pokémon dans la collection</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {collection.map((p) => {
                            const onExp = expeditions.some((e) => e.pokedexId === p.pokedexId && e.isShiny === p.isShiny);
                            return (
                              <button
                                key={`${p.pokedexId}-${p.isShiny}`}
                                onClick={() => !onExp && handleSelectPokemon(p)}
                                disabled={onExp || loadingAction}
                                className="flex flex-col items-center gap-1 p-2 rounded-lg transition-opacity"
                                style={{
                                  background: onExp ? "rgba(255,255,255,0.04)" : "rgba(99,102,241,0.15)",
                                  border: `1px solid ${onExp ? "rgba(255,255,255,0.1)" : RARITY_COLORS[p.rarity] ?? "#6366f1"}`,
                                  opacity: onExp ? 0.4 : 1,
                                }}
                              >
                                <img src={p.sprite} alt={p.name} className="w-10 h-10 object-contain" style={{ imageRendering: "pixelated", filter: p.isShiny ? "drop-shadow(0 0 4px gold)" : undefined }} />
                                <span className="font-[family-name:var(--font-pixel)] text-[7px] text-white text-center leading-tight truncate w-full">{p.name}</span>
                                <span className="font-[family-name:var(--font-pixel)] text-[6px]" style={{ color: RARITY_COLORS[p.rarity] ?? "#fff" }}>{p.rarity.toUpperCase()}</span>
                                {onExp && <span className="font-[family-name:var(--font-pixel)] text-[6px] text-orange-400">Expé.</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Phase: Battle */}
              {phase === "battle" && battle && (
                <div className="flex flex-col gap-3">
                  {/* Enemy */}
                  <div className="rounded-lg p-3" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                    <div className="flex items-center gap-3">
                      <img src={battle.enemySprite} alt={battle.enemyName} className="w-14 h-14 object-contain"
                        style={{ imageRendering: "pixelated", transform: enemyShake ? "translateX(-4px)" : "translateX(0)", transition: "transform 0.1s", animation: enemyShake ? "shake 0.4s ease" : undefined }} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-[family-name:var(--font-pixel)] text-[9px] text-white">{battle.enemyName}</span>
                          <StatusBadge status={battle.enemyStatus} />
                          <span className="font-[family-name:var(--font-pixel)] text-[7px]" style={{ color: RARITY_COLORS[battle.enemyRarity] ?? "#fff" }}>{battle.enemyRarity.toUpperCase()}</span>
                        </div>
                        <HPBar current={battle.enemyHP} max={battle.enemyMaxHP} color="#ef4444" />
                      </div>
                    </div>
                  </div>

                  {/* Player */}
                  <div className="rounded-lg p-3" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)" }}>
                    <div className="flex items-center gap-3">
                      <img src={battle.playerSprite} alt={battle.playerName} className="w-14 h-14 object-contain"
                        style={{ imageRendering: "pixelated", transform: playerShake ? "translateX(4px)" : "translateX(0)", transition: "transform 0.1s", animation: playerShake ? "shake 0.4s ease" : undefined }} />
                      <div className="flex-1">
                        <div className="flex items-center mb-1">
                          <p className="font-[family-name:var(--font-pixel)] text-[9px] text-white">
                            {battle.playerName}{battle.playerIsShiny && " ✨"}
                          </p>
                          <StatusBadge status={battle.playerStatus} />
                        </div>
                        <HPBar current={battle.playerHP} max={battle.playerMaxHP} color="#6366f1" />
                      </div>
                    </div>
                  </div>

                  {/* Combat log */}
                  <div ref={logRef} className="rounded-lg p-2 overflow-y-auto"
                    style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "80px", minHeight: "40px" }}>
                    {battle.log.slice(-5).map((line, i) => <LogLine key={i} line={line} />)}
                  </div>

                  {/* Move buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    {battle.playerMoves.map((move, idx) => (
                      <button key={idx} onClick={() => handleMove(idx)}
                        disabled={loadingAction || battle.status !== "active"}
                        className="flex flex-col items-start p-2 rounded-lg transition-opacity disabled:opacity-50"
                        style={{ background: `${TYPE_COLORS[move.type] ?? "#777"}22`, border: `1px solid ${TYPE_COLORS[move.type] ?? "#777"}` }}>
                        <span className="font-[family-name:var(--font-pixel)] text-[8px] text-white leading-tight">{move.name}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="font-[family-name:var(--font-pixel)] text-[7px] px-1 rounded" style={{ background: TYPE_COLORS[move.type] ?? "#777", color: "#fff" }}>{move.type}</span>
                          <span className="font-[family-name:var(--font-pixel)] text-[7px] text-slate-400">{move.power}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {loadingAction && (
                    <p className="font-[family-name:var(--font-pixel)] text-[8px] text-yellow-400 text-center animate-pulse">Attaque en cours...</p>
                  )}
                </div>
              )}

              {/* Phase: Result */}
              {phase === "result" && battle && (
                <div className="flex flex-col items-center gap-4 py-4">
                  {battle.status === "won" ? (
                    <>
                      <p className="font-[family-name:var(--font-pixel)] text-sm text-yellow-400" style={{ textShadow: "0 0 12px rgba(250,204,21,0.6)" }}>
                        🏆 Victoire !
                      </p>
                      <div className="w-full rounded-lg p-3 flex flex-col gap-2" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid #22c55e" }}>
                        <p className="font-[family-name:var(--font-pixel)] text-[9px] text-green-400 text-center mb-1">Récompenses</p>
                        {battle.rewards && (
                          <>
                            <div className="flex items-center gap-2">
                              <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png" alt="" className="w-6 h-6" style={{ imageRendering: "pixelated" }} />
                              <span className="font-[family-name:var(--font-pixel)] text-[9px] text-white">+{battle.rewards.candy} Candy</span>
                            </div>
                            {battle.rewards.dailyBonus ? (
                              <div className="flex items-center gap-2">
                                <span className="text-base">🌟</span>
                                <span className="font-[family-name:var(--font-pixel)] text-[9px] text-indigo-300">+{battle.rewards.dailyBonus} 🍬 Défi du Jour !</span>
                              </div>
                            ) : null}
                            {battle.rewards.itemDropped && (
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🎁</span>
                                <span className="font-[family-name:var(--font-pixel)] text-[9px] text-white">Objet : {battle.rewards.itemDropped}</span>
                              </div>
                            )}
                            {battle.rewards.bonusExpedition && (
                              <div className="flex items-center gap-2">
                                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/escape-rope.png" alt="" className="w-6 h-6" style={{ imageRendering: "pixelated" }} />
                                <span className="font-[family-name:var(--font-pixel)] text-[9px] text-green-300">Slot Expédition +1 !</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center">
                      <p className="font-[family-name:var(--font-pixel)] text-sm text-red-400">💀 KO !</p>
                      <p className="font-[family-name:var(--font-pixel)] text-[9px] text-slate-400 mt-2">{battle.playerName} a perdu.</p>
                    </div>
                  )}
                  <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 text-center">{battle.log[battle.log.length - 1]}</p>
                  <div className="flex gap-3">
                    <button onClick={() => { setPhase("select"); setBattle(null); setSelectedPokemon(null); }}
                      disabled={battlesUsed >= 3}
                      className="px-4 py-2 rounded-lg font-[family-name:var(--font-pixel)] text-[9px] text-white disabled:opacity-40"
                      style={{ background: battlesUsed >= 3 ? "rgba(255,255,255,0.1)" : "rgba(99,102,241,0.4)", border: "1px solid #6366f1" }}>
                      Nouveau combat
                    </button>
                    <button onClick={handleClose}
                      className="px-4 py-2 rounded-lg font-[family-name:var(--font-pixel)] text-[9px] text-slate-300"
                      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
                      Fermer
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* =================== PvP TAB =================== */}
          {activeTab === "pvp" && (
            <div className="flex flex-col gap-3">
              {/* Stats bar */}
              <div className="flex items-center justify-between px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <span className="font-[family-name:var(--font-pixel)] text-[8px] text-green-400">✅ {pvpWinsLocal}V</span>
                <div className="flex flex-col items-center">
                  <span className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400">{pvpChallengesUsed}/5 défis</span>
                  <span className="font-[family-name:var(--font-pixel)] text-[8px]" style={{ color: getEloRank(pvpEloLocal).color }}>
                    {getEloRank(pvpEloLocal).emoji} {pvpEloLocal} ELO
                  </span>
                </div>
                <span className="font-[family-name:var(--font-pixel)] text-[8px] text-red-400">{pvpLossesLocal}D ❌</span>
              </div>

              {/* PvP Menu */}
              {pvpPhase === "menu" && (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => { setPvpPhase("defense"); setSelectedDefense([]); }}
                    className="w-full py-3 rounded-lg font-[family-name:var(--font-pixel)] text-[9px] text-white text-left px-3"
                    style={{ background: "rgba(99,102,241,0.2)", border: "1px solid #6366f1" }}
                  >
                    🛡️ Mon Équipe de Défense
                    {defenseTeam.length > 0 && (
                      <span className="text-slate-400 ml-1">({defenseTeam.length} Pokémon)</span>
                    )}
                  </button>
                  <button
                    onClick={() => { setPvpPhase("challenge"); setPvpAttacker(null); setSelectedOpponent(null); loadOpponents(); }}
                    disabled={pvpChallengesUsed >= 5}
                    className="w-full py-3 rounded-lg font-[family-name:var(--font-pixel)] text-[9px] text-white text-left px-3 disabled:opacity-40"
                    style={{ background: "rgba(239,68,68,0.2)", border: "1px solid #ef4444" }}
                  >
                    ⚔️ Défier un Joueur
                    {pvpChallengesUsed >= 5 && <span className="text-red-400 ml-1">(limite atteinte)</span>}
                  </button>
                  <button
                    onClick={() => { setPvpPhase("history"); loadHistory(); }}
                    className="w-full py-3 rounded-lg font-[family-name:var(--font-pixel)] text-[9px] text-white text-left px-3"
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
                  >
                    📜 Historique des Combats
                  </button>

                  {/* Current defense team display */}
                  {loadingDefense ? (
                    <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 text-center animate-pulse">Chargement...</p>
                  ) : defenseTeam.length > 0 ? (
                    <div className="mt-2">
                      <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 mb-2">Équipe défensive actuelle :</p>
                      <div className="flex gap-2">
                        {defenseTeam.map((p: any, i: number) => (
                          <div key={i} className="flex flex-col items-center gap-1 p-2 rounded-lg" style={{ background: "rgba(99,102,241,0.1)", border: `1px solid ${RARITY_COLORS[p.rarity] ?? "#6366f1"}` }}>
                            <img src={p.sprite} alt={p.name} className="w-10 h-10 object-contain" style={{ imageRendering: "pixelated", filter: p.isShiny ? "drop-shadow(0 0 4px gold)" : undefined }} />
                            <span className="font-[family-name:var(--font-pixel)] text-[7px] text-white text-center truncate w-full">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-500 text-center mt-2">Aucune équipe de défense configurée</p>
                  )}
                </div>
              )}

              {/* Defense team setup */}
              {pvpPhase === "defense" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPvpPhase("menu")} className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400">← Retour</button>
                    <p className="font-[family-name:var(--font-pixel)] text-[9px] text-white">Choisir 1–3 Pokémon défenseurs</p>
                  </div>
                  <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400">
                    Sélectionnés : {selectedDefense.length}/3
                  </p>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {pvpCollection.map((p) => {
                      const onExp = pvpExpeditions.some((e) => e.pokedexId === p.pokedexId && e.isShiny === p.isShiny);
                      const selected = selectedDefense.some((s) => s.pokedexId === p.pokedexId && s.isShiny === p.isShiny);
                      return (
                        <button
                          key={`${p.pokedexId}-${p.isShiny}`}
                          onClick={() => {
                            if (onExp) return;
                            if (selected) {
                              setSelectedDefense((prev) => prev.filter((s) => !(s.pokedexId === p.pokedexId && s.isShiny === p.isShiny)));
                            } else if (selectedDefense.length < 3) {
                              setSelectedDefense((prev) => [...prev, p]);
                            }
                          }}
                          disabled={onExp || (!selected && selectedDefense.length >= 3)}
                          className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all"
                          style={{
                            background: selected ? "rgba(99,102,241,0.4)" : onExp ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)",
                            border: `1px solid ${selected ? "#6366f1" : onExp ? "rgba(255,255,255,0.05)" : RARITY_COLORS[p.rarity] ?? "#aaa"}`,
                            opacity: (onExp || (!selected && selectedDefense.length >= 3)) ? 0.4 : 1,
                          }}
                        >
                          <img src={p.sprite} alt={p.name} className="w-8 h-8 object-contain" style={{ imageRendering: "pixelated" }} />
                          <span className="font-[family-name:var(--font-pixel)] text-[6px] text-white truncate w-full text-center">{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={handleSaveDefense}
                    disabled={selectedDefense.length === 0 || loadingPvp}
                    className="w-full py-2 rounded-lg font-[family-name:var(--font-pixel)] text-[9px] text-white disabled:opacity-40"
                    style={{ background: "rgba(99,102,241,0.5)", border: "1px solid #6366f1" }}
                  >
                    {loadingPvp ? "Sauvegarde..." : "Confirmer l'équipe"}
                  </button>
                </div>
              )}

              {/* Challenge: pick attacker then opponent */}
              {pvpPhase === "challenge" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPvpPhase("menu")} className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400">← Retour</button>
                    <p className="font-[family-name:var(--font-pixel)] text-[9px] text-white">Défi PvP</p>
                  </div>

                  {/* Pick attacker */}
                  {!pvpAttacker && (
                    <>
                      <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400">1. Choisissez votre Pokémon :</p>
                      <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                        {pvpCollection.map((p) => {
                          const onExp = pvpExpeditions.some((e) => e.pokedexId === p.pokedexId && e.isShiny === p.isShiny);
                          return (
                            <button
                              key={`${p.pokedexId}-${p.isShiny}`}
                              onClick={() => !onExp && setPvpAttacker(p)}
                              disabled={onExp}
                              className="flex flex-col items-center gap-1 p-2 rounded-lg"
                              style={{
                                background: onExp ? "rgba(255,255,255,0.04)" : "rgba(239,68,68,0.15)",
                                border: `1px solid ${onExp ? "rgba(255,255,255,0.05)" : RARITY_COLORS[p.rarity] ?? "#ef4444"}`,
                                opacity: onExp ? 0.4 : 1,
                              }}
                            >
                              <img src={p.sprite} alt={p.name} className="w-8 h-8 object-contain" style={{ imageRendering: "pixelated", filter: p.isShiny ? "drop-shadow(0 0 4px gold)" : undefined }} />
                              <span className="font-[family-name:var(--font-pixel)] text-[6px] text-white truncate w-full text-center">{p.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Pick opponent */}
                  {pvpAttacker && !selectedOpponent && (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <button onClick={() => setPvpAttacker(null)} className="font-[family-name:var(--font-pixel)] text-[7px] text-slate-400">← Rechoisir</button>
                        <span className="font-[family-name:var(--font-pixel)] text-[8px] text-white">Attaque : {pvpAttacker.name}{pvpAttacker.isShiny ? " ✨" : ""}</span>
                      </div>
                      <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400">2. Choisissez un adversaire :</p>
                      {loadingOpponents ? (
                        <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 text-center animate-pulse">Chargement...</p>
                      ) : opponents.length === 0 ? (
                        <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-500 text-center">Aucun adversaire disponible</p>
                      ) : (
                        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                          {opponents.map((opp) => (
                            <button
                              key={opp._id}
                              onClick={() => setSelectedOpponent(opp)}
                              className="flex items-center gap-3 p-2 rounded-lg text-left"
                              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                            >
                              <div className="flex gap-1">
                                {opp.pvpDefenseTeam.slice(0, 3).map((p, i) => (
                                  <img key={i} src={p.sprite} alt={p.name} className="w-8 h-8 object-contain" style={{ imageRendering: "pixelated" }} />
                                ))}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-[family-name:var(--font-pixel)] text-[9px] text-white truncate">{opp.username}</p>
                                <p className="font-[family-name:var(--font-pixel)] text-[7px] text-slate-400">{opp.pvpWins}V / {opp.pvpLosses}D</p>
                                {opp.pvpElo !== undefined && (
                                  <p className="font-[family-name:var(--font-pixel)] text-[7px]" style={{ color: getEloRank(opp.pvpElo).color }}>
                                    {getEloRank(opp.pvpElo).emoji} {opp.pvpElo} ELO
                                  </p>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Confirm challenge */}
                  {pvpAttacker && selectedOpponent && (
                    <>
                      <div className="rounded-lg p-3" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)" }}>
                        <p className="font-[family-name:var(--font-pixel)] text-[9px] text-white mb-2">Confirmer le défi :</p>
                        <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-300">
                          {pvpAttacker.name}{pvpAttacker.isShiny ? " ✨" : ""} vs {selectedOpponent.username}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedOpponent(null)}
                          className="flex-1 py-2 rounded-lg font-[family-name:var(--font-pixel)] text-[9px] text-slate-300"
                          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
                        >
                          Annuler
                        </button>
                        <button
                          onClick={handleChallenge}
                          disabled={loadingPvp}
                          className="flex-1 py-2 rounded-lg font-[family-name:var(--font-pixel)] text-[9px] text-white disabled:opacity-50"
                          style={{ background: "rgba(239,68,68,0.5)", border: "1px solid #ef4444" }}
                        >
                          {loadingPvp ? "Combat..." : "⚔️ Attaquer !"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* PvP Result */}
              {pvpPhase === "result" && pvpResult && (
                <div className="flex flex-col items-center gap-3">
                  <p
                    className="font-[family-name:var(--font-pixel)] text-sm"
                    style={{ color: pvpResult.result === "challenger" ? "#facc15" : "#ef4444" }}
                  >
                    {pvpResult.result === "challenger" ? "🏆 Victoire PvP !" : "💀 Défaite PvP"}
                  </p>
                  {pvpResult.candyEarned > 0 && (
                    <p className="font-[family-name:var(--font-pixel)] text-[9px] text-green-300">+{pvpResult.candyEarned} 🍬</p>
                  )}
                  {pvpEloChange !== null && (
                    <p className="font-[family-name:var(--font-pixel)] text-[9px]" style={{ color: pvpEloChange >= 0 ? "#4ade80" : "#f87171" }}>
                      {pvpEloChange >= 0 ? "+" : ""}{pvpEloChange} ELO → {pvpEloLocal} ({getEloRank(pvpEloLocal).emoji} {getEloRank(pvpEloLocal).label})
                    </p>
                  )}

                  {/* Battle log replay */}
                  <div className="w-full rounded-lg p-2 overflow-y-auto" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "120px" }}>
                    {pvpResult.log.map((line, i) => (
                      <p key={i} className="font-[family-name:var(--font-pixel)] text-[7px] text-slate-300 leading-relaxed">{line}</p>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setPvpPhase("challenge"); setPvpAttacker(null); setSelectedOpponent(null); setPvpResult(null); loadOpponents(); }}
                      disabled={pvpChallengesUsed >= 5}
                      className="px-3 py-2 rounded-lg font-[family-name:var(--font-pixel)] text-[9px] text-white disabled:opacity-40"
                      style={{ background: "rgba(239,68,68,0.3)", border: "1px solid #ef4444" }}
                    >
                      Nouveau défi
                    </button>
                    <button
                      onClick={() => { setPvpPhase("menu"); setPvpResult(null); }}
                      className="px-3 py-2 rounded-lg font-[family-name:var(--font-pixel)] text-[9px] text-slate-300"
                      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
                    >
                      Menu PvP
                    </button>
                  </div>
                </div>
              )}

              {/* PvP History */}
              {pvpPhase === "history" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPvpPhase("menu")} className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400">← Retour</button>
                    <p className="font-[family-name:var(--font-pixel)] text-[9px] text-white">Historique PvP</p>
                  </div>
                  {pvpHistory.length === 0 ? (
                    <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-500 text-center py-4">Aucun combat PvP récent</p>
                  ) : (
                    pvpHistory.map((ch) => {
                      const isChallenger = ch.challengerName !== undefined;
                      const won = ch.result === "challenger" ? ch.challengerName : ch.defenderName;
                      return (
                        <div key={ch._id} className="rounded-lg p-2 flex items-center justify-between"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                          <div>
                            <p className="font-[family-name:var(--font-pixel)] text-[8px] text-white">
                              {ch.challengerName} vs {ch.defenderName}
                            </p>
                            <p className="font-[family-name:var(--font-pixel)] text-[7px] text-slate-400">
                              🏆 {won} a gagné
                            </p>
                          </div>
                          <div className="text-right">
                            {ch.candyChallenger > 0 && (
                              <p className="font-[family-name:var(--font-pixel)] text-[7px] text-green-400">+{ch.candyChallenger} 🍬</p>
                            )}
                            {ch.candyDefender > 0 && (
                              <p className="font-[family-name:var(--font-pixel)] text-[7px] text-green-400">+{ch.candyDefender} 🍬</p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
