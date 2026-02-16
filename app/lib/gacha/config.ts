import { Rarity } from "@/app/types";
import crypto from "crypto";

export const SHINY_RATE = 1/128;
interface Tier {
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

function secureRandom(): number {
  // Utilise un entier 32 bits pour obtenir un flottant dans [0, 1)
  const buf = crypto.randomBytes(4);
  const int = buf.readUInt32BE(0); // number
  return int / 0xffffffff;
}

export function eggSpinningWheel(): {
  selectedTier: Tier;
  isShiny: boolean;
} {
  const randomValue = secureRandom();
  let cumulativeWeight = 0;

  for (const tier of LOOT_TABLE) {
    cumulativeWeight += tier.chance;
    if (randomValue < cumulativeWeight) {
      return { selectedTier: tier, isShiny: secureRandom() < SHINY_RATE };
    }
  }

  // fallback
  return {
    selectedTier: LOOT_TABLE[LOOT_TABLE.length - 1],
    isShiny: secureRandom() < SHINY_RATE,
  };
}

