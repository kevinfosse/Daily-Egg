interface PokemonData {
    name: string;
    types: string[];
    sprite: string;
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
  
      const data: PokemonData = {
        name: species.names.find((n: any) => n.language.name === "fr")?.name ?? pokemon.name,
        types: pokemon.types.map((t: any) => t.type.name),
        sprite: pokemon.sprites.other["official-artwork"].front_default,
      };
  
      cache.set(id, data);
      return data;
    } catch (error) {
      console.error(`Failed to fetch Pokemon #${id}:`, error);
      return null;
    }
  }