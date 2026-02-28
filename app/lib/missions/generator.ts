import { DailyMission } from "@/app/types";
import crypto from "crypto";

const POKEMON_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

function hashSeed(userId: string, dateStr: string): number {
  const hash = crypto.createHash("sha256").update(`${userId}:${dateStr}`).digest();
  return hash.readUInt32BE(0);
}

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

export function generateDailyMissions(userId: string): DailyMission[] {
  const dateStr = getTodayStr();
  const seed = hashSeed(userId, dateStr);

  const typeIndex = seed % POKEMON_TYPES.length;
  const targetType = POKEMON_TYPES[typeIndex];

  return [
    {
      type: "hatch_daily",
      description: "Fais éclore ton oeuf quotidien",
      target: 1,
      progress: 0,
      completed: false,
      claimed: false,
      rewardType: "bonusEgg",
      rewardAmount: 1,
    },
    {
      type: "spin_daily",
      description: "Utilise la roue de la chance",
      target: 1,
      progress: 0,
      completed: false,
      claimed: false,
      rewardType: "mysteryTicket",
      rewardAmount: 1,
    },
    {
      type: "collect_type",
      description: `Obtiens un Pokémon de type ${targetType}`,
      target: 1,
      progress: 0,
      completed: false,
      claimed: false,
      rewardType: "item",
      rewardAmount: 1,
      rewardItemId: "incense_rare",
      metadata: targetType,
    },
  ];
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function ensureMissionsForToday(userDoc: any, userId: string): boolean {
  const now = new Date();
  const lastReset = userDoc.lastMissionResetDate as Date | null;

  if (lastReset && isSameDay(lastReset, now)) {
    return false; // already generated today
  }

  userDoc.dailyMissions = generateDailyMissions(userId);
  userDoc.lastMissionResetDate = now;
  return true; // missions were regenerated
}
