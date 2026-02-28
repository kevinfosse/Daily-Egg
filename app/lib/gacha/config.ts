import { Rarity } from "@/app/types";
import crypto from "crypto";

export const SHINY_RATE = 1/128;

export interface Tier {
  rarity: Rarity;
  chance: number;
}

const LOOT_TABLE: Tier[] = [
  { rarity: "legendary", chance: 0.03 },
  { rarity: "epic", chance: 0.07 },
  { rarity: "rare", chance: 0.15 },
  { rarity: "uncommon", chance: 0.25 },
  { rarity: "common", chance: 0.50 },
];

const MYSTERY_LOOT_TABLE: Tier[] = [
  { rarity: "legendary", chance: 0.10 },
  { rarity: "epic", chance: 0.30 },
  { rarity: "rare", chance: 0.60 },
];

// Mapping rarity -> plage de Pokedex IDs pour generatePokemonByRarity (spin)
export const RARITY_CONFIG = {
  COMMON: { pokemonRange: { min: 1, max: 150 } },
  UNCOMMON: { pokemonRange: { min: 1, max: 400 } },
  RARE: { pokemonRange: { min: 1, max: 700 } },
  EPIC: { pokemonRange: { min: 1, max: 900 } },
  LEGENDARY: { pokemonRange: { min: 1, max: 1025 } },
} as const;

export function secureRandom(): number {
  const buf = crypto.randomBytes(4);
  const int = buf.readUInt32BE(0);
  return int / 0xffffffff;
}

function spinWheel(table: Tier[]): { selectedTier: Tier; isShiny: boolean } {
  const randomValue = secureRandom();
  let cumulativeWeight = 0;

  for (const tier of table) {
    cumulativeWeight += tier.chance;
    if (randomValue < cumulativeWeight) {
      return { selectedTier: tier, isShiny: secureRandom() < SHINY_RATE };
    }
  }

  return {
    selectedTier: table[table.length - 1],
    isShiny: secureRandom() < SHINY_RATE,
  };
}

export function eggSpinningWheel() {
  return spinWheel(LOOT_TABLE);
}

export function mysteryTicketWheel() {
  return spinWheel(MYSTERY_LOOT_TABLE);
}

