import { secureRandom } from "@/app/lib/gacha/config";

export interface BattleMove {
  name: string;
  power: number;
  type: string;
  category: "physical" | "special";
  statusEffect?: "burned" | "paralyzed";
  statusChance?: number;
}

// --- Type effectiveness chart (18 types) ---
// Values: 2 = super effective, 1 = normal, 0.5 = not very effective, 0 = immune
export const TYPE_CHART: Record<string, Record<string, number>> = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice:      { water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy:    { fighting: 2, poison: 0.5, bug: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

// --- 2 moves per type (weak + strong) ---
// Lance-Flammes has 10% burn chance, Tonnerre has 30% paralysis chance
export const TYPE_MOVES: Record<string, [BattleMove, BattleMove]> = {
  normal:   [{ name: "Charge", power: 40, type: "normal", category: "physical" }, { name: "Coup Éclat", power: 65, type: "normal", category: "physical" }],
  fire:     [{ name: "Flammèche", power: 40, type: "fire", category: "special" }, { name: "Lance-Flammes", power: 90, type: "fire", category: "special", statusEffect: "burned", statusChance: 0.10 }],
  water:    [{ name: "Pistolet à O", power: 40, type: "water", category: "special" }, { name: "Hydrocanon", power: 110, type: "water", category: "special" }],
  electric: [{ name: "Éclair", power: 40, type: "electric", category: "special" }, { name: "Tonnerre", power: 90, type: "electric", category: "special", statusEffect: "paralyzed", statusChance: 0.30 }],
  grass:    [{ name: "Tranch'Herbe", power: 55, type: "grass", category: "physical" }, { name: "Tempêtherbe", power: 120, type: "grass", category: "special" }],
  ice:      [{ name: "Cryo-Soin", power: 45, type: "ice", category: "special" }, { name: "Blizzard", power: 110, type: "ice", category: "special" }],
  fighting: [{ name: "Karaté", power: 50, type: "fighting", category: "physical" }, { name: "Mégapoing", power: 80, type: "fighting", category: "physical" }],
  poison:   [{ name: "Dard-Venin", power: 35, type: "poison", category: "physical" }, { name: "Bomb'Beurk", power: 90, type: "poison", category: "special" }],
  ground:   [{ name: "Attaque Sable", power: 40, type: "ground", category: "physical" }, { name: "Séisme", power: 100, type: "ground", category: "physical" }],
  flying:   [{ name: "Rafale Psy", power: 35, type: "flying", category: "physical" }, { name: "Aéropique", power: 80, type: "flying", category: "physical" }],
  psychic:  [{ name: "Choc Mental", power: 50, type: "psychic", category: "special" }, { name: "Psyko", power: 90, type: "psychic", category: "special" }],
  bug:      [{ name: "Coupe", power: 50, type: "bug", category: "physical" }, { name: "Vibrobug", power: 90, type: "bug", category: "special" }],
  rock:     [{ name: "Jet-Pierres", power: 25, type: "rock", category: "physical" }, { name: "Éboulement", power: 75, type: "rock", category: "physical" }],
  ghost:    [{ name: "Léchouille", power: 30, type: "ghost", category: "physical" }, { name: "Ombre Portée", power: 80, type: "ghost", category: "physical" }],
  dragon:   [{ name: "Draco-Queue", power: 60, type: "dragon", category: "physical" }, { name: "Draco-Météore", power: 130, type: "dragon", category: "special" }],
  dark:     [{ name: "Morsure", power: 60, type: "dark", category: "physical" }, { name: "Jackpot", power: 80, type: "dark", category: "physical" }],
  steel:    [{ name: "Griffe Métal", power: 50, type: "steel", category: "physical" }, { name: "Lame d'Acier", power: 70, type: "steel", category: "physical" }],
  fairy:    [{ name: "Éclat Magique", power: 40, type: "fairy", category: "special" }, { name: "Dazzling Gleam", power: 80, type: "fairy", category: "special" }],
};

export const GENERIC_MOVES: BattleMove[] = [
  { name: "Charge", power: 40, type: "normal", category: "physical" },
  { name: "Coup Éclat", power: 65, type: "normal", category: "physical" },
];

export const BATTLE_CANDY_REWARDS: Record<string, number> = {
  common: 5,
  uncommon: 12,
  rare: 30,
  epic: 60,
  legendary: 150,
};

// Status immunities: which types are immune to each status
export const STATUS_IMMUNITIES: Record<string, string[]> = {
  burned:    ["fire"],
  paralyzed: ["electric"],
};

// Check if a status can be applied to a defender with given types
export function canApplyStatus(status: string, defenderTypes: string[]): boolean {
  const immuneTypes = STATUS_IMMUNITIES[status] ?? [];
  return !defenderTypes.some((t) => immuneTypes.includes(t));
}

// Roll for a critical hit — shiny pokemon crit 2x more often (1/8 vs 1/16)
export function rollCritical(isShiny: boolean): boolean {
  return secureRandom() < (isShiny ? 1 / 8 : 1 / 16);
}

// Build a 4-move set from the pokemon's types
export function getMoveset(types: string[]): BattleMove[] {
  const moves: BattleMove[] = [];

  // Primary type: both moves
  const primary = types[0] ?? "normal";
  const primaryMoves = TYPE_MOVES[primary] ?? TYPE_MOVES["normal"];
  moves.push(primaryMoves[0], primaryMoves[1]);

  // Secondary type: first move only (if different)
  if (types[1] && types[1] !== primary) {
    const secondaryMoves = TYPE_MOVES[types[1]] ?? TYPE_MOVES["normal"];
    moves.push(secondaryMoves[0]);
  }

  // Fill to 4 with generic normal moves (avoid duplicates)
  for (const gm of GENERIC_MOVES) {
    if (moves.length >= 4) break;
    if (!moves.find((m) => m.name === gm.name)) {
      moves.push(gm);
    }
  }

  return moves.slice(0, 4);
}

// Compute type effectiveness multiplier for a move against a defender
export function getTypeMultiplier(moveType: string, defenderTypes: string[]): number {
  const chart = TYPE_CHART[moveType] ?? {};
  let multiplier = 1;
  for (const defType of defenderTypes) {
    multiplier *= chart[defType] ?? 1;
  }
  return multiplier;
}

// Derive battle stats from raw PokeAPI base stats
export function calcStats(rawHP: number, rawATK: number, rawDEF: number) {
  return {
    maxHP: Math.floor(rawHP * 0.5 + 50),
    atk: Math.floor(rawATK * 0.5 + 5),
    def: Math.floor(rawDEF * 0.5 + 5),
  };
}

// Calculate damage dealt
export function calcDamage(atk: number, def: number, power: number, typeMultiplier: number): number {
  const base = Math.floor((atk * power) / (def * 2)) + 2;
  const randomBonus = Math.floor(secureRandom() * 5); // 0–4
  return Math.max(1, Math.floor(base * typeMultiplier) + randomBonus);
}
