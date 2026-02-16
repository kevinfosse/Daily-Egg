import type { HatchedPokemon, Rarity } from "@/app/types";

export type GuestMode = "guest";

export type GuestStateV1 = {
  version: 1;
  username: string;
  lastHatchDateIso: string | null;
  streak: number;
  bestStreak: number;
  totalHatchedPokemons: number;
  totalShinyHatchedPokemons: number;
  pokemons: HatchedPokemon[];
};

const GUEST_STORAGE_KEY = "pokeDaily.guest.v1";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadGuestState(): GuestStateV1 | null {
  if (typeof window === "undefined") return null;
  const parsed = safeParse<GuestStateV1>(window.localStorage.getItem(GUEST_STORAGE_KEY));
  if (!parsed || parsed.version !== 1) return null;
  return parsed;
}

export function initGuestState(username = "Invité"): GuestStateV1 {
  const state: GuestStateV1 = {
    version: 1,
    username,
    lastHatchDateIso: null,
    streak: 0,
    bestStreak: 0,
    totalHatchedPokemons: 0,
    totalShinyHatchedPokemons: 0,
    pokemons: [],
  };
  saveGuestState(state);
  return state;
}

export function saveGuestState(state: GuestStateV1) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(state));
}

export function clearGuestState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(GUEST_STORAGE_KEY);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isYesterday(a: Date, b: Date) {
  const yesterday = new Date(b.getFullYear(), b.getMonth(), b.getDate() - 1);
  return isSameDay(a, yesterday);
}

export function guestCanHatchNow(state: GuestStateV1, now = new Date()): boolean {
  if (!state.lastHatchDateIso) return true;
  const last = new Date(state.lastHatchDateIso);
  if (Number.isNaN(last.getTime())) return true;
  return !isSameDay(last, now);
}

export function applyGuestHatch(
  state: GuestStateV1,
  hatchedPokemon: {
    pokedexId: number;
    name: string;
    types: string[];
    sprite: string;
    isShiny: boolean;
    rarity: string;
  },
  now = new Date()
): GuestStateV1 {
  const last = state.lastHatchDateIso ? new Date(state.lastHatchDateIso) : null;

  const next: GuestStateV1 = {
    ...state,
    lastHatchDateIso: now.toISOString(),
    totalHatchedPokemons: state.totalHatchedPokemons + 1,
    totalShinyHatchedPokemons: state.totalShinyHatchedPokemons + (hatchedPokemon.isShiny ? 1 : 0),
  };

  // Streak
  const nextStreak = last && !Number.isNaN(last.getTime()) && isYesterday(last, now) ? next.streak + 1 : 1;
  next.streak = nextStreak;
  next.bestStreak = Math.max(next.bestStreak, nextStreak);

  // Collection: same key (id + shiny) => increment count
  const idx = next.pokemons.findIndex(
    (p) => Number(p.pokedexId) === hatchedPokemon.pokedexId && p.isShiny === hatchedPokemon.isShiny
  );

  const rarity = (hatchedPokemon.rarity as Rarity) ?? "common";
  const hatchedAt = now as unknown as Date; // stored as JSON anyway

  if (idx >= 0) {
    const existing = next.pokemons[idx];
    const updated: HatchedPokemon = {
      ...existing,
      count: (existing.count || 0) + 1,
      hatchedAt,
    };
    next.pokemons = [...next.pokemons.slice(0, idx), updated, ...next.pokemons.slice(idx + 1)];
  } else {
    const created: HatchedPokemon = {
      pokedexId: String(hatchedPokemon.pokedexId),
      name: hatchedPokemon.name,
      types: hatchedPokemon.types ?? [],
      sprite: hatchedPokemon.sprite,
      isShiny: hatchedPokemon.isShiny,
      rarity,
      count: 1,
      hatchedAt,
    };
    next.pokemons = [...next.pokemons, created];
  }

  saveGuestState(next);
  return next;
}

