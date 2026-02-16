interface PokemonData {
  name: string;
  types: string[];
  spriteDefault: string;
  spriteShiny: string;
  isLegendary: boolean;
  isMythical: boolean;
  isBaby: boolean;
  evolvesFromSpeciesId: number | null;
  baseStatTotal: number;
}
  
  const cache = new Map<number, PokemonData>();
  
  export async function fetchPokemon(id: number): Promise<PokemonData | null> {
    if (cache.has(id)) {
      return cache.get(id)!;
    }
  
    try {
      const [pokemonRes, speciesRes] = await Promise.all([
        fetch(`https://pokeapi.co/api/v2/pokemon/${id}`),
        fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
      ]);
  
      if (!pokemonRes.ok || !speciesRes.ok) {
        throw new Error(`PokeAPI error: ${pokemonRes.status}`);
      }
  
      const pokemon = await pokemonRes.json();
      const species = await speciesRes.json();

      const spriteDefault =
        pokemon?.sprites?.other?.["official-artwork"]?.front_default ??
        pokemon?.sprites?.other?.home?.front_default ??
        pokemon?.sprites?.front_default ??
        "";

      const spriteShiny =
        pokemon?.sprites?.other?.home?.front_shiny ??
        pokemon?.sprites?.front_shiny ??
        spriteDefault;
  
      const baseStatTotal = Array.isArray(pokemon?.stats)
        ? pokemon.stats.reduce((sum: number, s: any) => sum + (Number(s?.base_stat) || 0), 0)
        : 0;

      const data: PokemonData = {
        name:
          species.names.find((n: any) => n.language.name === "fr")?.name ??
          pokemon.name,
        types: pokemon.types.map((t: any) => t.type.name),
        spriteDefault,
        spriteShiny,
        isLegendary: Boolean(species?.is_legendary),
        isMythical: Boolean(species?.is_mythical),
        isBaby: Boolean(species?.is_baby),
        evolvesFromSpeciesId: typeof species?.evolves_from_species?.url === "string"
          ? Number(String(species.evolves_from_species.url).split("/").filter(Boolean).pop() ?? NaN) || null
          : null,
        baseStatTotal,
      };
  
      cache.set(id, data);
      return data;
    } catch (error) {
      console.error(`Failed to fetch Pokemon #${id}:`, error);
      return null;
    }
  }