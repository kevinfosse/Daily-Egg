export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  type: "consumable" | "held";
  emoji: string;
}

export const ITEMS: Record<string, ItemDefinition> = {
  incense_rare: {
    id: "incense_rare",
    name: "Encens Rare",
    description: "Prochain œuf : rareté minimum = rare",
    type: "consumable",
    emoji: "🌿",
  },
  incense_epic: {
    id: "incense_epic",
    name: "Encens Épique",
    description: "Prochain œuf : rareté minimum = épique",
    type: "consumable",
    emoji: "🔮",
  },
  rare_candy: {
    id: "rare_candy",
    name: "Bonbon Rare",
    description: "Prochaine évolution gratuite (0 candy)",
    type: "consumable",
    emoji: "🍭",
  },
  amulet_coin: {
    id: "amulet_coin",
    name: "Amulette Pièce",
    description: "×2 candy en expédition",
    type: "held",
    emoji: "💰",
  },
  macho_brace: {
    id: "macho_brace",
    name: "Bracelet Bras",
    description: "Garantit 1 Œuf Bonus à la réclamation d'expédition",
    type: "held",
    emoji: "💪",
  },
  lum_berry: {
    id: "lum_berry",
    name: "Baie Lum",
    description: "Réclamation d'expédition autorisée 30 min plus tôt",
    type: "held",
    emoji: "🍒",
  },
};

export const ALL_ITEM_IDS = Object.keys(ITEMS);
