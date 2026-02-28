import { Schema, model, models } from "mongoose";

const PvpPokemonSummarySchema = new Schema(
  {
    name: { type: String, required: true },
    sprite: { type: String, required: true },
    rarity: { type: String, required: true },
  },
  { _id: false }
);

const PvpChallengeSchema = new Schema(
  {
    challengerId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    challengerName: { type: String, required: true },
    challengerPokemon: { type: PvpPokemonSummarySchema, required: true },
    defenderId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    defenderName: { type: String, required: true },
    defenseTeam: { type: [PvpPokemonSummarySchema], default: [] },
    result: { type: String, enum: ["challenger", "defender"], required: true },
    log: { type: [String], default: [] },
    candyChallenger: { type: Number, default: 0 },
    candyDefender: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 }, // TTL 7 days
  }
);

PvpChallengeSchema.index({ challengerId: 1, createdAt: -1 });
PvpChallengeSchema.index({ defenderId: 1, createdAt: -1 });

if (models.PvpChallenge) {
  delete (models as any).PvpChallenge;
}

export default model("PvpChallenge", PvpChallengeSchema);
