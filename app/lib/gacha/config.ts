import { Rarity } from "@/app/types";
import crypto from "crypto";

export const SHINY_RATE = 1/128;
interface GetPokemon {
    rarity: Rarity;
    chance: number;
    pokemonRange: {min: number, max: number}
}

const LOOT_TABLE: GetPokemon[] = [
    {
        rarity: "legendary",
        chance: 0.03,
        pokemonRange: {min: 494, max: 649},
    },
    {
        rarity: "epic",
        chance: 0.07,
        pokemonRange: {min: 387, max: 493},
    },
    {
        rarity: "rare",
        chance: 0.15,
        pokemonRange: {min: 252, max: 386},
    },
    {
        rarity: "uncommon",
        chance: 0.25,
        pokemonRange: {min: 152, max: 251},
    },
    {
        rarity: "common",
        chance: 0.50,
        pokemonRange: {min: 1, max: 151},
    }    
];

function secureRandom(): number {
    // Utilise un entier 32 bits pour obtenir un flottant dans [0, 1)
    const buf = crypto.randomBytes(4);
    const int = buf.readUInt32BE(0); // number
    return int / 0xffffffff;
}

export function eggSpinningWheel(): {
    selectedTier: GetPokemon;
    pokemonId: number;
    isShiny: boolean;
} {
    const randomValue = secureRandom();
    let cumulativeWeight = 0;

    for (const tier of LOOT_TABLE) {
        cumulativeWeight += tier.chance;
        if (randomValue < cumulativeWeight) {
            const selectedTier = tier;
            const pokemonId =
                Math.floor(
                    secureRandom() * (tier.pokemonRange.max - tier.pokemonRange.min + 1),
                ) + tier.pokemonRange.min;
            const isShiny = secureRandom() < SHINY_RATE;

            return { selectedTier, pokemonId, isShiny };
        }
    }

    const fallbackTier = LOOT_TABLE[LOOT_TABLE.length - 1];
    const pokemonId =
        Math.floor(
            Math.random() * (fallbackTier.pokemonRange.max - fallbackTier.pokemonRange.min + 1),
        ) + fallbackTier.pokemonRange.min;
    const isShiny = Math.random() < SHINY_RATE;
    return { selectedTier: fallbackTier, pokemonId, isShiny };
}

