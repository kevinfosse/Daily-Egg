export interface User { 
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
    pokemons: HatchedPokemon[];
    streak: number;
    bestStreak: number;
    lastHatchDate: Date | null;
    totalHatchedPokemons: number;
    totalShinyHatchedPokemons: number;
}

export interface HatchedPokemon {
    pokedexId: string;
    name: string;
    types: string[];
    sprite: string;
    isShiny : boolean;
    rarity: Rarity;
    count: number;
    hatchedAt: Date;
}

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";