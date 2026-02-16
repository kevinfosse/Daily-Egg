"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Pokedex from "./component/Pokedex";
import StarfieldBackground from "./component/StarfieldBackground";
import EggHatch from "./component/EggHatch";
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
}

interface HatchResult {
  hatchedPokemon: {
    pokedexId: number;
    name: string;
    types: string[];
    sprite: string;
    isShiny: boolean;
    rarity: string;
  };
  streak: number;
  bestStreak: number;
  totalHatchedPokemons: number;
  totalShinyHatchedPokemons: number;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [hatchResult, setHatchResult] = useState<HatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [pokedexOpen, setPokedexOpen] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

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
    });
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/user")
        .then((res) => res.json())
        .then((data) => setUserData(data));
    }
  }, [status]);

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
        setHatchResult(data);
        const pokemon = data.hatchedPokemon;
        if (pokemon && (pokemon.rarity === "legendary" || pokemon.rarity === "epic" || pokemon.rarity === "rare")) {
          // On envoie l'info à la barre de notif (sans await pour ne pas ralentir le jeu)
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
              }
            : prev
        );
      }
    } catch (error) {
      console.error("Hatch failed:", error);
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
              🔥 {userData.streak} jour{userData.streak > 1 ? "s" : ""} | Record : {userData.bestStreak}
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
        <div className="w-full grid grid-cols-3 gap-3 mb-8">
        <div className="pixel-box p-3 text-center">
          <p className="text-2xl font-bold text-white">{userData.totalHatchedPokemons}</p>
          <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 mt-1">Éclosions</p>
        </div>
        <div className="pixel-box p-3 text-center">
          <p className="text-2xl font-bold text-white">{userData.collectionSize}</p>
          <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 mt-1">Collection</p>
        </div>
        <div className="pixel-box p-3 text-center">
          <p className="text-2xl font-bold text-white">{userData.totalShinyHatchedPokemons}</p>
          <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 mt-1">Shiny</p>
        </div>
      </div>

        {/* Zone d'éclosion */}
        <div className="w-full flex flex-col items-center">

          {/* Peut éclore */}
          <EggHatch
          onHatch={handleHatch}
          hatchResult={hatchResult?.hatchedPokemon ?? null}
          canHatch={userData.canHatch}
          loading={loading}
          />


        {/* Bouton collection */}
        <button
          onClick={() => setPokedexOpen(true)}
          className="mt-8 pixel-button px-6 py-2 text-sm font-bold text-white"
        >
          Pokédex ({userData.collectionSize})
        </button>

        <Pokedex isOpen={pokedexOpen} onClose={() => setPokedexOpen(false)} isGuest={isGuest} />
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