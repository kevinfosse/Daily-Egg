import { Schema, model, models } from "mongoose";

export interface IWonderTrade {
  depositorId: Schema.Types.ObjectId;
  depositorUsername: string;
  pokemon: {
    pokedexId: number;
    name: string;
    types: string[];
    sprite: string;
    isShiny: boolean;
    rarity: string;
  };
  depositedAt: Date;
}

const WonderTradeSchema = new Schema<IWonderTrade>({
  depositorId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  depositorUsername: { type: String, required: true },
  pokemon: {
    pokedexId: { type: Number, required: true },
    name: { type: String, required: true },
    types: { type: [String], required: true },
    sprite: { type: String, required: true },
    isShiny: { type: Boolean, default: false },
    rarity: { type: String, required: true },
  },
  depositedAt: { type: Date, default: Date.now },
});

// TTL index: auto-delete after 7 days
WonderTradeSchema.index({ depositedAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

export default models.WonderTrade || model<IWonderTrade>("WonderTrade", WonderTradeSchema);
