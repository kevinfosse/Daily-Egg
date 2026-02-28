import { eggSpinningWheel, mysteryTicketWheel } from "@/app/lib/gacha/config";
import { fetchPokemon } from "@/app/lib/pokeapi/pokeapi";

const MAX_POKEDEX_ID = 1025;

type PokemonData = NonNullable<Awaited<ReturnType<typeof fetchPokemon>>>;

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];

export function classifyRarity(p: PokemonData): string {
  if (p.isLegendary || p.isMythical) return "legendary";
  if (p.isBaby) return "common";

  const bst = p.baseStatTotal || 0;
  if (bst >= 540) return "epic";
  if (bst >= 480) return "rare";
  if (bst >= 380) return "uncommon";
  return "common";
}

async function rollPokemonWithWheel(
  wheelFn: () => { selectedTier: { rarity: string }; isShiny: boolean },
  minRarity?: string
) {
  const pick = wheelFn();
  const isShiny = pick.isShiny;

  // Pity: enforce minimum rarity if specified
  const rolledRarity = pick.selectedTier.rarity;
  const targetRarity =
    minRarity && RARITY_ORDER.indexOf(rolledRarity) < RARITY_ORDER.indexOf(minRarity)
      ? minRarity
      : rolledRarity;

  let pokemonId: number | null = null;
  let fetchedPokemon: PokemonData | null = null;
  let rarity: string | null = null;

  const maxAttempts = 80;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidateId = 1 + Math.floor(Math.random() * MAX_POKEDEX_ID);
    const candidate = await fetchPokemon(candidateId);
    if (!candidate) continue;

    const candidateRarity = classifyRarity(candidate);
    if (candidateRarity !== targetRarity) continue;

    pokemonId = candidateId;
    fetchedPokemon = candidate;
    rarity = candidateRarity;
    break;
  }

  if (!fetchedPokemon || pokemonId == null || !rarity) {
    return { error: "Failed to roll a Pokémon for this rarity (try again)" as const };
  }

  const sprite = isShiny ? fetchedPokemon.spriteShiny : fetchedPokemon.spriteDefault;

  return { pokemonId, fetchedPokemon, rarity, isShiny, sprite };
}

export async function rollPokemonForEgg() {
  return rollPokemonWithWheel(eggSpinningWheel);
}

export async function rollPokemonForEggWithPity(pityCounter: number, overrideMinRarity?: string) {
  const pityMin = pityCounter >= 50 ? "epic" : undefined;
  // Use the override (combined externally) if provided, else fall back to pity
  const minRarity = overrideMinRarity ?? pityMin;
  return rollPokemonWithWheel(eggSpinningWheel, minRarity);
}

export async function rollPokemonForMystery() {
  return rollPokemonWithWheel(mysteryTicketWheel);
}
