// Shared utility for deterministic daily Pokemon ID based on UTC date
export function getDailyPokemonId(): number {
  const now = new Date();
  const dateStr = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  let hash = 5381;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash * 33) ^ dateStr.charCodeAt(i)) >>> 0;
  }
  return (hash % 1025) + 1;
}
