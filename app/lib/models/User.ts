import mongoose, { Schema, model, models } from "mongoose";
import { User, HatchedPokemon, DailyMission, ActiveExpedition, InventoryItem, BattleMove, PvpPokemon, SafariChallenge } from "@/app/types";

const InventoryItemSchema = new Schema<InventoryItem>(
  {
    itemId: { type: String, required: true },
    quantity: { type: Number, default: 1 },
  },
  { _id: false }
);

const HatchedPokemonSchema = new Schema<HatchedPokemon>(
  {
    pokedexId: { type: Number, required: true },
    name: { type: String, required: true },
    types: { type: [String], required: true },
    sprite: { type: String, required: true },
    isShiny: { type: Boolean, default: false },
    rarity: {
      type: String,
      enum: ["common", "uncommon", "rare", "epic", "legendary"],
      required: true,
    },
    count: { type: Number, default: 1 },
    hatchedAt: { type: Date, default: Date.now },
    equippedItem: { type: String, default: null },
  },
  { _id: false }
);

const DailyMissionSchema = new Schema<DailyMission>(
  {
    type: { type: String, enum: ["hatch_daily", "spin_daily", "collect_type"], required: true },
    description: { type: String, required: true },
    target: { type: Number, required: true },
    progress: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    claimed: { type: Boolean, default: false },
    rewardType: { type: String, enum: ["bonusEgg", "mysteryTicket", "item"], required: true },
    rewardAmount: { type: Number, default: 1 },
    rewardItemId: { type: String, default: null },
    metadata: { type: String, default: null },
  },
  { _id: false }
);

const BattleMoveSchema = new Schema<BattleMove>(
  {
    name: { type: String, required: true },
    power: { type: Number, required: true },
    type: { type: String, required: true },
    category: { type: String, enum: ["physical", "special"], required: true },
  },
  { _id: false }
);

const CurrentBattleSchema = new Schema(
  {
    playerPokedexId: { type: Number, required: true },
    playerIsShiny: { type: Boolean, default: false },
    playerName: { type: String, required: true },
    playerSprite: { type: String, required: true },
    playerTypes: { type: [String], default: [] },
    playerHP: { type: Number, required: true },
    playerMaxHP: { type: Number, required: true },
    playerATK: { type: Number, required: true },
    playerDEF: { type: Number, required: true },
    playerMoves: { type: [BattleMoveSchema], default: [] },
    playerStatus: { type: String, enum: ["none", "burned", "paralyzed"], default: "none" },
    enemyPokedexId: { type: Number, required: true },
    enemyName: { type: String, required: true },
    enemySprite: { type: String, required: true },
    enemyTypes: { type: [String], default: [] },
    enemyRarity: { type: String, required: true },
    enemyHP: { type: Number, required: true },
    enemyMaxHP: { type: Number, required: true },
    enemyATK: { type: Number, required: true },
    enemyDEF: { type: Number, required: true },
    enemyMoves: { type: [BattleMoveSchema], default: [] },
    enemyStatus: { type: String, enum: ["none", "burned", "paralyzed"], default: "none" },
    turn: { type: Number, default: 1 },
    log: { type: [String], default: [] },
    status: { type: String, enum: ["active", "won", "lost"], default: "active" },
    rewards: {
      type: {
        candy: { type: Number, default: 0 },
        itemDropped: { type: String, default: null },
        bonusExpedition: { type: Boolean, default: false },
        dailyBonus: { type: Number, default: 0 },
      },
      default: null,
    },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const PvpPokemonSchema = new Schema<PvpPokemon>(
  {
    pokedexId: { type: Number, required: true },
    isShiny: { type: Boolean, default: false },
    name: { type: String, required: true },
    sprite: { type: String, required: true },
    rarity: { type: String, required: true },
    types: { type: [String], default: [] },
    baseHP: { type: Number, required: true },
    baseATK: { type: Number, required: true },
    baseDEF: { type: Number, required: true },
  },
  { _id: false }
);

const SafariChallengeSchema = new Schema<SafariChallenge>(
  {
    pokemonId: { type: Number, required: true },
    correctName: { type: String, required: true },
  },
  { _id: false }
);

const ActiveExpeditionSchema = new Schema<ActiveExpedition>(
  {
    pokedexId: { type: Number, required: true },
    isShiny: { type: Boolean, default: false },
    pokemonName: { type: String, required: true },
    pokemonSprite: { type: String, required: true },
    pokemonRarity: { type: String, required: true },
    startedAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    equippedItem: { type: String, default: null },
  },
  { _id: false }
);

const UserSchema = new Schema<User>(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Minimum 3 characters"],
      maxlength: [20, "Maximum 20 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    pokemons: {
      type: [HatchedPokemonSchema],
      default: [],
    },

    // Éclosion quotidienne
    streak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    lastHatchDate: { type: Date, default: null },
    totalHatchedPokemons: { type: Number, default: 0 },
    totalShinyHatchedPokemons: { type: Number, default: 0 },

    // Spin
    lastSpinDate: { type: Date, default: null },
    mysteryTickets: { type: Number, default: 0 },
    bonusEggs: { type: Number, default: 0 },
    totalSpins: { type: Number, default: 0 },

    // Missions
    dailyMissions: { type: [DailyMissionSchema], default: [] },
    lastMissionResetDate: { type: Date, default: null },

    // Wonder Trade
    lastWonderTradeDate: { type: Date, default: null },
    wonderTradesToday: { type: Number, default: 0 },

    // Candy
    candy: { type: Number, default: 0 },

    // Pity
    pityCounter: { type: Number, default: 0 },

    // Streak milestones
    claimedStreakMilestones: { type: [Number], default: [] },

    // Expeditions
    activeExpeditions: { type: [ActiveExpeditionSchema], default: [] },

    // Items
    inventory: { type: [InventoryItemSchema], default: [] },
    nextEggMinRarity: { type: String, default: null },
    freeEvolveReady: { type: Boolean, default: false },

    // Battle
    currentBattle: { type: CurrentBattleSchema, default: null },
    dailyBattles: { type: Number, default: 0 },
    lastBattleDate: { type: Date, default: null },
    bonusExpeditionSlots: { type: Number, default: 0 },

    // Daily challenge
    dailyChallengeWon: { type: Boolean, default: false },
    lastChallengeDateStr: { type: String, default: null },

    // PvP
    pvpDefenseTeam: { type: [PvpPokemonSchema], default: [] },
    pvpWins: { type: Number, default: 0 },
    pvpLosses: { type: Number, default: 0 },
    dailyPvpChallenges: { type: Number, default: 0 },
    lastPvpDate: { type: Date, default: null },
    pvpElo: { type: Number, default: 1000 },

    // Safari Zone
    dailySafariAttempts: { type: Number, default: 0 },
    lastSafariDate: { type: Date, default: null },
    safariWinStreak: { type: Number, default: 0 },
    currentSafariChallenge: { type: SafariChallengeSchema, default: null },
  },
  {
    timestamps: true,
  }
);

// Indexes for leaderboard queries
UserSchema.index({ totalHatchedPokemons: -1 });
UserSchema.index({ totalShinyHatchedPokemons: -1 });
UserSchema.index({ bestStreak: -1 });

// Supprime le modèle en cache pour forcer la recompilation avec le schéma à jour
// (évite que les champs ajoutés après la 1ère compilation soient ignorés par Mongoose strict mode)
if (models.User) {
  delete (models as any).User;
}

export default model<User>("User", UserSchema);
