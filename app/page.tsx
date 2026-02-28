"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Pokedex from "./component/Pokedex";
import StarfieldBackground from "./component/StarfieldBackground";
import EggHatch from "./component/EggHatch";
import MissionBoard from "./component/MissionBoard";
import Leaderboard from "./component/Leaderboard";
import WonderTrade from "./component/WonderTrade";
import CandyShop from "./component/CandyShop";
import Expeditions from "./component/Expeditions";
import Bag from "./component/Bag";
import ChanceWheel from "./component/ChanceWheel";
import BattleArena from "./component/BattleArena";
import SafariZone from "./component/SafariZone";
import {
  applyGuestHatch,
  clearGuestState,
  guestCanHatchNow,
  initGuestState,
  loadGuestState,
} from "@/app/lib/guest/storage";
import NotificationBar from "./component/LogBar";

interface UserData {
  username: string;
  canHatch: boolean;
  streak: number;
  bestStreak: number;
  totalHatchedPokemons: number;
  totalShinyHatchedPokemons: number;
  collectionSize: number;
  mysteryTickets: number;
  bonusEggs: number;
  candy: number;
  pityCounter: number;
  readyExpeditions: number;
  nextEggMinRarity?: string | null;
  freeEvolveReady?: boolean;
  dailyBattles?: number;
  bonusExpeditionSlots?: number;
  hasBattleActive?: boolean;
  dailyChallengeWon?: boolean;
  pvpWins?: number;
  pvpLosses?: number;
  dailyPvpChallenges?: number;
  pvpElo?: number;
  dailySafariAttempts?: number;
  safariWinStreak?: number;
}

interface FeaturedPokemon {
  id: number;
  name: string;
  sprite: string;
  types: string[];
  rarity: string;
}

interface MilestoneReward {
  days: number;
  field: string;
  amount: number;
  label: string;
}

interface HatchResult {
  hatchedPokemon: {
    pokedexId: number;
    name: string;
    types: string[];
    sprite: string;
    isShiny: boolean;
    rarity: string;
    isFeaturedMatch?: boolean;
  };
  streak: number;
  bestStreak: number;
  totalHatchedPokemons: number;
  totalShinyHatchedPokemons: number;
  pityCounter?: number;
  bonusEggs?: number;
  mysteryTickets?: number;
  milestoneRewards?: MilestoneReward[];
  isFeaturedMatch?: boolean;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [hatchResult, setHatchResult] = useState<HatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [pokedexOpen, setPokedexOpen] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [wonderTradeOpen, setWonderTradeOpen] = useState(false);
  const [candyShopOpen, setCandyShopOpen] = useState(false);
  const [expeditionsOpen, setExpeditionsOpen] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [spinOpen, setSpinOpen] = useState(false);
  const [battleOpen, setBattleOpen] = useState(false);
  const [safariOpen, setSafariOpen] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [unclaimedMissions, setUnclaimedMissions] = useState(0);
  const [featuredPokemon, setFeaturedPokemon] = useState<FeaturedPokemon | null>(null);
  const [featuredObtainedToday, setFeaturedObtainedToday] = useState(false);
  const [milestoneToast, setMilestoneToast] = useState<MilestoneReward[]>([]);

  useEffect(() => {
    if (status !== "unauthenticated") return;

    const guest = loadGuestState();
    if (!guest) {
      router.push("/login");
      return;
    }

    setIsGuest(true);
    setUserData({
      username: guest.username ?? "Invité",
      canHatch: guestCanHatchNow(guest),
      streak: guest.streak ?? 0,
      bestStreak: guest.bestStreak ?? 0,
      totalHatchedPokemons: guest.totalHatchedPokemons ?? 0,
      totalShinyHatchedPokemons: guest.totalShinyHatchedPokemons ?? 0,
      collectionSize: guest.pokemons?.length ?? 0,
      mysteryTickets: 0,
      bonusEggs: 0,
      candy: 0,
      pityCounter: 0,
      readyExpeditions: 0,
    });
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/user")
        .then((res) => res.json())
        .then((data) => setUserData(data));
      fetch("/api/daily-pokemon")
        .then((res) => res.json())
        .then((data) => { if (!data.error) setFeaturedPokemon(data); })
        .catch(() => {});
    }
  }, [status]);

  // Auto-dismiss milestone toast after 5s
  useEffect(() => {
    if (milestoneToast.length === 0) return;
    const t = setTimeout(() => setMilestoneToast([]), 5000);
    return () => clearTimeout(t);
  }, [milestoneToast]);

  // Check unclaimed missions periodically
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/missions")
      .then((res) => res.json())
      .then((data) => {
        const missions = data.missions || [];
        const count = missions.filter((m: any) => m.completed && !m.claimed).length;
        setUnclaimedMissions(count);
      })
      .catch(() => {});
  }, [status, hatchResult]);

  // Periodically refresh readyExpeditions badge
  useEffect(() => {
    if (status !== "authenticated") return;
    const check = () => {
      fetch("/api/expeditions")
        .then((r) => r.json())
        .then((data) => {
          const now = Date.now();
          const ready = (data.expeditions ?? []).filter(
            (e: any) => new Date(e.endsAt).getTime() <= now
          ).length;
          setUserData((prev) => prev ? { ...prev, readyExpeditions: ready } : prev);
        })
        .catch(() => {});
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [status]);

  const refreshUserData = () => {
    if (status === "authenticated") {
      fetch("/api/user")
        .then((res) => res.json())
        .then((data) => setUserData(data));
    }
  };

  const handleHatch = async () => {
    setLoading(true);
    try {
      if (status === "unauthenticated") {
        const guest = loadGuestState() ?? initGuestState("Invité");
        if (!guestCanHatchNow(guest)) {
          setUserData((prev) => (prev ? { ...prev, canHatch: false } : prev));
          setLoading(false);
          return;
        }

        const res = await fetch("/api/hatch", { method: "POST" });
        const data = await res.json();
        if (res.ok && data?.hatchedPokemon) {
          const next = applyGuestHatch(guest, data.hatchedPokemon);
          setHatchResult({
            hatchedPokemon: data.hatchedPokemon,
            streak: next.streak,
            bestStreak: next.bestStreak,
            totalHatchedPokemons: next.totalHatchedPokemons,
            totalShinyHatchedPokemons: next.totalShinyHatchedPokemons,
          });
          setUserData((prev) =>
            prev
              ? {
                  ...prev,
                  canHatch: false,
                  streak: next.streak,
                  bestStreak: next.bestStreak,
                  totalHatchedPokemons: next.totalHatchedPokemons,
                  totalShinyHatchedPokemons: next.totalShinyHatchedPokemons,
                  collectionSize: next.pokemons.length,
                }
              : prev
          );
        }

        setLoading(false);
        return;
      }

      const res = await fetch("/api/hatch", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        // Attach featuredMatch to hatchedPokemon for EggHatch display
        const enrichedData = {
          ...data,
          hatchedPokemon: { ...data.hatchedPokemon, isFeaturedMatch: data.isFeaturedMatch },
        };
        setHatchResult(enrichedData);

        if (data.isFeaturedMatch) setFeaturedObtainedToday(true);
        if (data.milestoneRewards?.length > 0) setMilestoneToast(data.milestoneRewards);

        const pokemon = data.hatchedPokemon;
        if (pokemon && (pokemon.rarity === "legendary" || pokemon.rarity === "epic" || pokemon.rarity === "rare")) {
          fetch('/api/activity', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  message: `${userData?.username || "Un joueur"} a obtenu ${pokemon.name} !`,
                  pokemonName: pokemon.name
              })
          });
        }
        setUserData((prev) =>
          prev
            ? {
                ...prev,
                canHatch: false,
                streak: data.streak,
                bestStreak: data.bestStreak,
                totalHatchedPokemons: data.totalHatchedPokemons,
                totalShinyHatchedPokemons: data.totalShinyHatchedPokemons,
                collectionSize: prev.collectionSize + 1,
                pityCounter: data.pityCounter ?? prev.pityCounter,
                ...(data.bonusEggs !== undefined && { bonusEggs: data.bonusEggs }),
                ...(data.mysteryTickets !== undefined && { mysteryTickets: data.mysteryTickets }),
              }
            : prev
        );
      }
    } catch (error) {
      console.error("Hatch failed:", error);
    }
    setLoading(false);
  };

  const handleBonusHatch = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hatch/bonus", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setHatchResult({
          hatchedPokemon: data.hatchedPokemon,
          streak: userData?.streak ?? 0,
          bestStreak: userData?.bestStreak ?? 0,
          totalHatchedPokemons: data.totalHatchedPokemons,
          totalShinyHatchedPokemons: data.totalShinyHatchedPokemons,
        });
        setUserData((prev) =>
          prev
            ? {
                ...prev,
                bonusEggs: data.bonusEggs,
                totalHatchedPokemons: data.totalHatchedPokemons,
                totalShinyHatchedPokemons: data.totalShinyHatchedPokemons,
                collectionSize: prev.collectionSize + 1,
              }
            : prev
        );
      }
    } catch (error) {
      console.error("Bonus hatch failed:", error);
    }
    setLoading(false);
  };

  const handleMysteryHatch = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hatch/mystery", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setHatchResult({
          hatchedPokemon: data.hatchedPokemon,
          streak: userData?.streak ?? 0,
          bestStreak: userData?.bestStreak ?? 0,
          totalHatchedPokemons: data.totalHatchedPokemons,
          totalShinyHatchedPokemons: data.totalShinyHatchedPokemons,
        });
        setUserData((prev) =>
          prev
            ? {
                ...prev,
                mysteryTickets: data.mysteryTickets,
                totalHatchedPokemons: data.totalHatchedPokemons,
                totalShinyHatchedPokemons: data.totalShinyHatchedPokemons,
                collectionSize: prev.collectionSize + 1,
              }
            : prev
        );
      }
    } catch (error) {
      console.error("Mystery hatch failed:", error);
    }
    setLoading(false);
  };

  const handleLeaveGuest = () => {
    clearGuestState();
    setIsGuest(false);
    setUserData(null);
    router.push("/login");
  };

  if (status === "loading" || !userData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#0a1628] via-[#1a237e] to-[#0d47a1]">
        <StarfieldBackground />
        <p className="relative z-10 font-[family-name:var(--font-pixel)] text-sm text-yellow-400 animate-pulse">
          Chargement...
        </p>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center bg-gradient-to-b from-[#0a1628] via-[#1a237e] to-[#0d47a1] px-4 py-8">
      <StarfieldBackground />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">

        {/* Header */}
        <div className="w-full flex justify-between items-center mb-6">
          <div>
            <h1 className="font-[family-name:var(--font-pixel)] text-sm text-yellow-400">
              PokéDaily
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              {"\uD83D\uDD25"} {userData.streak} jour{userData.streak > 1 ? "s" : ""} | Record : {userData.bestStreak}
            </p>
          </div>
          {isGuest ? (
            <button
              onClick={handleLeaveGuest}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Quitter invité
            </button>
          ) : (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Déconnexion
            </button>
          )}
        </div>

        <NotificationBar/>

        {/* Stats */}
        <div className="w-full grid grid-cols-4 gap-2 mb-8">
          <div className="pixel-box p-3 text-center">
            <img
              src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lucky-egg.png"
              alt=""
              className="w-6 h-6 mx-auto"
              style={{ imageRendering: "pixelated" }}
            />
            <p className="text-lg font-bold text-white">{userData.totalHatchedPokemons}</p>
            <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400">Éclosions</p>
          </div>
          <div className="pixel-box p-3 text-center">
            <img
              src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png"
              alt=""
              className="w-6 h-6 mx-auto"
              style={{ imageRendering: "pixelated" }}
            />
            <p className="text-lg font-bold text-white">{userData.collectionSize}</p>
            <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400">Collection</p>
          </div>
          <div className="pixel-box p-3 text-center">
            <img
              src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/star-piece.png"
              alt=""
              className="w-6 h-6 mx-auto"
              style={{ imageRendering: "pixelated" }}
            />
            <p className="text-lg font-bold text-white">{userData.totalShinyHatchedPokemons}</p>
            <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400">Shiny</p>
          </div>
          <div
            className="p-3 text-center rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
            style={{ background: "rgba(236,72,153,0.15)", border: "1px solid #ec4899" }}
            onClick={() => !isGuest && setCandyShopOpen(true)}
          >
            <img
              src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png"
              alt=""
              className="w-6 h-6 mx-auto"
              style={{ imageRendering: "pixelated" }}
            />
            <p className="text-lg font-bold text-pink-300">{userData.candy ?? 0}</p>
            <p className="font-[family-name:var(--font-pixel)] text-[8px] text-pink-500">Candy</p>
          </div>
        </div>

        {/* Pokémon du Jour */}
        {!isGuest && featuredPokemon && (
          <div
            className="w-full mb-6 px-4 py-3 rounded-lg flex items-center gap-3"
            style={{
              background: featuredObtainedToday
                ? "rgba(34,197,94,0.12)"
                : "rgba(99,102,241,0.12)",
              border: `1px solid ${featuredObtainedToday ? "#22c55e" : "#6366f1"}`,
            }}
          >
            <img
              src={featuredPokemon.sprite}
              alt={featuredPokemon.name}
              className="w-12 h-12 object-contain"
              style={{ imageRendering: "pixelated" }}
            />
            <div className="flex-1 min-w-0">
              <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 mb-0.5">
                Pokémon du Jour
              </p>
              <p className="font-[family-name:var(--font-pixel)] text-xs text-white truncate">
                {featuredPokemon.name}
              </p>
              <p
                className="font-[family-name:var(--font-pixel)] text-[8px] mt-0.5"
                style={{ color: getRarityColor(featuredPokemon.rarity) }}
              >
                {featuredPokemon.rarity.toUpperCase()}
              </p>
            </div>
            {featuredObtainedToday ? (
              <span className="font-[family-name:var(--font-pixel)] text-[8px] text-green-400">
                ✓ Obtenu !
              </span>
            ) : (
              <span className="font-[family-name:var(--font-pixel)] text-[8px] text-indigo-400">
                À attraper !
              </span>
            )}
          </div>
        )}

        {/* Zone d'éclosion */}
        <div className="w-full flex flex-col items-center">

          <EggHatch
          onHatch={handleHatch}
          hatchResult={hatchResult?.hatchedPokemon ?? null}
          canHatch={userData.canHatch}
          loading={loading}
          pityCounter={userData.pityCounter ?? 0}
          />

          {/* Bonus / Mystery buttons (authenticated only) */}
          {!isGuest && (userData.bonusEggs > 0 || userData.mysteryTickets > 0) && (
            <div className="flex gap-3 mt-4">
              {userData.bonusEggs > 0 && (
                <button
                  onClick={handleBonusHatch}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold text-white rounded-lg disabled:opacity-50 font-[family-name:var(--font-pixel)]"
                  style={{
                    background: "#7c3aed",
                    borderBottom: "3px solid #5b21b6",
                    boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)",
                  }}
                >
                  <img
                    src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lucky-egg.png"
                    alt=""
                    className="w-5 h-5"
                    style={{ imageRendering: "pixelated" }}
                  />
                  ×{userData.bonusEggs}
                </button>
              )}
              {userData.mysteryTickets > 0 && (
                <button
                  onClick={handleMysteryHatch}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold text-black rounded-lg disabled:opacity-50 font-[family-name:var(--font-pixel)]"
                  style={{
                    background: "#facc15",
                    borderBottom: "3px solid #ca8a04",
                    boxShadow: "0 4px 12px rgba(250, 204, 21, 0.3)",
                  }}
                >
                  <img
                    src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png"
                    alt=""
                    className="w-5 h-5"
                    style={{ imageRendering: "pixelated" }}
                  />
                  ×{userData.mysteryTickets}
                </button>
              )}
            </div>
          )}

        {/* Action buttons */}
        <div className="grid grid-cols-4 gap-3 mt-8 w-full">
          <button
            onClick={() => setPokedexOpen(true)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl transition-opacity hover:opacity-80"
            style={{ background: "rgba(99,102,241,0.2)", border: "1px solid #6366f1" }}
          >
            <img
              src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-radar.png"
              alt="Pokédex"
              className="w-10 h-10 object-contain"
              style={{ imageRendering: "pixelated" }}
            />
            <span className="font-[family-name:var(--font-pixel)] text-[7px] text-white">Pokédex</span>
            <span className="font-[family-name:var(--font-pixel)] text-[6px] text-slate-400">{userData.collectionSize}</span>
          </button>

          {!isGuest && (
            <>
              <button
                onClick={() => setMissionsOpen(true)}
                className="relative flex flex-col items-center gap-1 p-2 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: "rgba(34,197,94,0.2)", border: "1px solid #22c55e" }}
              >
                {unclaimedMissions > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center">
                    {unclaimedMissions}
                  </span>
                )}
                <img
                  src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/medal-box.png"
                  alt="Missions"
                  className="w-10 h-10 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
                <span className="font-[family-name:var(--font-pixel)] text-[7px] text-white">Missions</span>
              </button>

              <button
                onClick={() => setSpinOpen(true)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: "rgba(217,119,6,0.2)", border: "1px solid #d97706" }}
              >
                <img
                  src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/amulet-coin.png"
                  alt="Roue"
                  className="w-10 h-10 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
                <span className="font-[family-name:var(--font-pixel)] text-[7px] text-white">Roue</span>
              </button>

              <button
                onClick={() => setLeaderboardOpen(true)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: "rgba(14,165,233,0.2)", border: "1px solid #0ea5e9" }}
              >
                <img
                  src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/kings-rock.png"
                  alt="Classement"
                  className="w-10 h-10 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
                <span className="font-[family-name:var(--font-pixel)] text-[7px] text-white">Top</span>
              </button>

              <button
                onClick={() => setWonderTradeOpen(true)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: "rgba(225,29,72,0.2)", border: "1px solid #e11d48" }}
              >
                <img
                  src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/cherish-ball.png"
                  alt="Wonder Trade"
                  className="w-10 h-10 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
                <span className="font-[family-name:var(--font-pixel)] text-[7px] text-white">Trade</span>
              </button>

              <button
                onClick={() => setCandyShopOpen(true)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: "rgba(190,24,93,0.2)", border: "1px solid #be185d" }}
              >
                <img
                  src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png"
                  alt="Candy Shop"
                  className="w-10 h-10 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
                <span className="font-[family-name:var(--font-pixel)] text-[7px] text-white">Candy</span>
              </button>

              <button
                onClick={() => setExpeditionsOpen(true)}
                className="relative flex flex-col items-center gap-1 p-2 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: "rgba(194,65,12,0.2)", border: "1px solid #c2410c" }}
              >
                {(userData.readyExpeditions ?? 0) > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center">
                    {userData.readyExpeditions}
                  </span>
                )}
                <img
                  src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/escape-rope.png"
                  alt="Expéditions"
                  className="w-10 h-10 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
                <span className="font-[family-name:var(--font-pixel)] text-[7px] text-white">Expédi.</span>
              </button>

              <button
                onClick={() => setBagOpen(true)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: "rgba(124,58,237,0.2)", border: "1px solid #7c3aed" }}
              >
                <img
                  src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/explorer-kit.png"
                  alt="Sac"
                  className="w-10 h-10 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
                <span className="font-[family-name:var(--font-pixel)] text-[7px] text-white">Sac</span>
              </button>

              <button
                onClick={() => setBattleOpen(true)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: "rgba(220,38,38,0.2)", border: "1px solid #dc2626" }}
              >
                <img
                  src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/tm-fighting.png"
                  alt="Combat"
                  className="w-10 h-10 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
                <span className="font-[family-name:var(--font-pixel)] text-[7px] text-white">Combat</span>
                <span className="font-[family-name:var(--font-pixel)] text-[6px] text-slate-400">
                  {userData.dailyBattles ?? 0}/3
                </span>
              </button>

              <button
                onClick={() => setSafariOpen(true)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: "rgba(34,197,94,0.2)", border: "1px solid #16a34a" }}
              >
                <img
                  src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/safari-ball.png"
                  alt="Safari"
                  className="w-10 h-10 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
                <span className="font-[family-name:var(--font-pixel)] text-[7px] text-white">Safari</span>
                <span className="font-[family-name:var(--font-pixel)] text-[6px] text-slate-400">
                  {5 - (userData.dailySafariAttempts ?? 0)}/5
                </span>
              </button>
            </>
          )}
        </div>

        {/* Milestone toast */}
        {milestoneToast.length > 0 && (
          <div
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-center"
            style={{
              background: "rgba(15,23,42,0.95)",
              border: "2px solid #f59e0b",
              boxShadow: "0 0 24px rgba(245,158,11,0.4)",
              minWidth: "220px",
              animation: "pokemon-reveal 0.4s ease-out",
            }}
          >
            <p className="font-[family-name:var(--font-pixel)] text-yellow-400 text-[10px] mb-1">
              🔥 Palier {milestoneToast[0].label} !
            </p>
            {milestoneToast.map((m) => (
              <p key={m.days} className="font-[family-name:var(--font-pixel)] text-white text-xs">
                +{m.amount} {m.field === "bonusEggs" ? "Œufs Bonus" : "Tickets Mystère"}
              </p>
            ))}
          </div>
        )}

        <Pokedex
          isOpen={pokedexOpen}
          onClose={() => setPokedexOpen(false)}
          isGuest={isGuest}
          candy={userData.candy ?? 0}
          onEvolve={(newCandy) => {
            setUserData((prev) => prev ? { ...prev, candy: newCandy } : prev);
          }}
        />
        <CandyShop
          isOpen={candyShopOpen}
          onClose={() => setCandyShopOpen(false)}
          candy={userData.candy ?? 0}
          onCandyChange={(newCandy, updates) => {
            setUserData((prev) =>
              prev
                ? {
                    ...prev,
                    candy: newCandy,
                    ...(updates?.bonusEggs !== undefined && { bonusEggs: updates.bonusEggs }),
                    ...(updates?.mysteryTickets !== undefined && { mysteryTickets: updates.mysteryTickets }),
                  }
                : prev
            );
          }}
        />
        <MissionBoard
          isOpen={missionsOpen}
          onClose={() => setMissionsOpen(false)}
          onRewardClaimed={refreshUserData}
        />
        <Leaderboard isOpen={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />
        <WonderTrade
          isOpen={wonderTradeOpen}
          onClose={() => setWonderTradeOpen(false)}
          onTradeComplete={refreshUserData}
        />
        <Expeditions
          isOpen={expeditionsOpen}
          onClose={() => setExpeditionsOpen(false)}
          onRewardClaimed={({ candy, bonusEggs, mysteryTickets }) => {
            setUserData((prev) =>
              prev
                ? {
                    ...prev,
                    candy,
                    bonusEggs,
                    mysteryTickets,
                    readyExpeditions: Math.max(0, (prev.readyExpeditions ?? 0) - 1),
                  }
                : prev
            );
          }}
        />
        <Bag
          isOpen={bagOpen}
          onClose={() => setBagOpen(false)}
          onItemUsed={({ nextEggMinRarity, freeEvolveReady }) => {
            setUserData((prev) =>
              prev ? { ...prev, nextEggMinRarity, freeEvolveReady } : prev
            );
          }}
        />
        <ChanceWheel
          isOpen={spinOpen}
          onClose={() => setSpinOpen(false)}
          onSpinComplete={({ mysteryTickets, bonusEggs }) => {
            setUserData((prev) =>
              prev ? { ...prev, mysteryTickets, bonusEggs } : prev
            );
          }}
        />
        <BattleArena
          isOpen={battleOpen}
          onClose={() => setBattleOpen(false)}
          dailyBattles={userData.dailyBattles ?? 0}
          dailyChallengeWon={userData.dailyChallengeWon ?? false}
          pvpWins={userData.pvpWins ?? 0}
          pvpLosses={userData.pvpLosses ?? 0}
          dailyPvpChallenges={userData.dailyPvpChallenges ?? 0}
          pvpElo={userData.pvpElo ?? 1000}
          featuredPokemon={featuredPokemon}
          onBattleEnd={({ candy, bonusExpeditionSlots, dailyChallengeWon, pvpElo }) => {
            setUserData((prev) =>
              prev ? { ...prev, candy, bonusExpeditionSlots, dailyChallengeWon, ...(pvpElo !== undefined && { pvpElo }) } : prev
            );
          }}
        />
        <SafariZone
          isOpen={safariOpen}
          onClose={() => setSafariOpen(false)}
          onRewardClaimed={({ candy }) => {
            setUserData((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                candy: (prev.candy ?? 0) + candy,
                dailySafariAttempts: (prev.dailySafariAttempts ?? 0) + 1,
              };
            });
          }}
        />
      </div>
      </div>
    </main>
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
  return colors[rarity] || "#FFFFFF";
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
  return colors[type] || "#777777";
}
