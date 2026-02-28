// types/index.ts

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface InventoryItem {
  itemId: string;
  quantity: number;
}

export interface HatchedPokemon {
  pokedexId: number;
  name: string;
  types: string[];
  sprite: string;
  isShiny: boolean;
  rarity: Rarity;
  count: number;
  hatchedAt: Date;
  equippedItem?: string;
}

export type MissionType = "hatch_daily" | "spin_daily" | "collect_type";

export interface DailyMission {
  type: MissionType;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  rewardType: "bonusEgg" | "mysteryTicket" | "item";
  rewardAmount: number;
  rewardItemId?: string;
  metadata?: string; // e.g. pokemon type for collect_type
}

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;

  // Collection
  pokemons: HatchedPokemon[];

  // Éclosion quotidienne
  streak: number;
  bestStreak: number;
  lastHatchDate: Date | null;
  totalHatchedPokemons: number;
  totalShinyHatchedPokemons: number;

  // Spin
  lastSpinDate: Date | null;
  mysteryTickets: number;
  bonusEggs: number;
  totalSpins: number;

  // Missions
  dailyMissions: DailyMission[];
  lastMissionResetDate: Date | null;

  // Wonder Trade
  lastWonderTradeDate: Date | null;
  wonderTradesToday: number;

  // Candy
  candy: number;

  // Pity
  pityCounter: number;

  // Streak milestones
  claimedStreakMilestones: number[];

  // Expeditions
  activeExpeditions: ActiveExpedition[];

  // Items
  inventory: InventoryItem[];
  nextEggMinRarity?: string;
  freeEvolveReady?: boolean;

  // Battle
  currentBattle?: CurrentBattle;
  dailyBattles: number;
  lastBattleDate: Date | null;
  bonusExpeditionSlots: number;

  // Daily challenge
  dailyChallengeWon: boolean;
  lastChallengeDateStr: string | null;

  // PvP
  pvpDefenseTeam: PvpPokemon[];
  pvpWins: number;
  pvpLosses: number;
  dailyPvpChallenges: number;
  lastPvpDate: Date | null;
  pvpElo: number;

  // Safari Zone
  dailySafariAttempts: number;
  lastSafariDate: Date | null;
  safariWinStreak: number;
  currentSafariChallenge?: SafariChallenge | null;
}

export interface ActiveExpedition {
  pokedexId: number;
  isShiny: boolean;
  pokemonName: string;
  pokemonSprite: string;
  pokemonRarity: string;
  startedAt: Date;
  endsAt: Date;
  equippedItem?: string;
}

export interface BattleMove {
  name: string;
  power: number;
  type: string;
  category: "physical" | "special";
  statusEffect?: "burned" | "paralyzed";
  statusChance?: number;
}

export type BattleStatus = "none" | "burned" | "paralyzed";

export interface CurrentBattle {
  playerPokedexId: number;
  playerIsShiny: boolean;
  playerName: string;
  playerSprite: string;
  playerTypes: string[];
  playerHP: number;
  playerMaxHP: number;
  playerATK: number;
  playerDEF: number;
  playerMoves: BattleMove[];
  playerStatus: BattleStatus;
  enemyPokedexId: number;
  enemyName: string;
  enemySprite: string;
  enemyTypes: string[];
  enemyRarity: string;
  enemyHP: number;
  enemyMaxHP: number;
  enemyATK: number;
  enemyDEF: number;
  enemyMoves: BattleMove[];
  enemyStatus: BattleStatus;
  turn: number;
  log: string[];
  status: "active" | "won" | "lost";
  rewards?: { candy: number; itemDropped?: string; bonusExpedition: boolean; dailyBonus?: number };
  expiresAt: string;
}

export interface PvpPokemon {
  pokedexId: number;
  isShiny: boolean;
  name: string;
  sprite: string;
  rarity: string;
  types: string[];
  baseHP: number;
  baseATK: number;
  baseDEF: number;
}

export interface SafariChallenge {
  pokemonId: number;
  correctName: string;
}
