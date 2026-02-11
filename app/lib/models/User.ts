import { Schema, model, models } from "mongoose";
import { User, HatchedPokemon } from "@/app/types";

const HatchedPokemonSchema = new Schema<HatchedPokemon>(
  {
    pokedexId: { type: Number as any, required: true },
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
    streak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    lastHatchDate: { type: Date, default: null },
    totalHatchedPokemons: { type: Number, default: 0 },
    totalShinyHatchedPokemons: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export default models.User || model<User>("User", UserSchema);