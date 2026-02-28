import { MissionType } from "@/app/types";

/**
 * Advance missions on a user document in memory (before save).
 * @param userDoc - Mongoose user document (mutable)
 * @param type - The mission type to advance
 * @param metadata - Optional metadata (e.g. pokemon type for collect_type)
 */
export function advanceMissionsOnDoc(
  userDoc: any,
  type: MissionType,
  metadata?: string
) {
  if (!userDoc.dailyMissions || userDoc.dailyMissions.length === 0) return;

  for (const mission of userDoc.dailyMissions) {
    if (mission.type !== type) continue;
    if (mission.completed) continue;

    // For collect_type, check the metadata matches
    if (type === "collect_type" && metadata && mission.metadata !== metadata) {
      continue;
    }

    mission.progress = Math.min((mission.progress || 0) + 1, mission.target);
    if (mission.progress >= mission.target) {
      mission.completed = true;
    }
  }
}
