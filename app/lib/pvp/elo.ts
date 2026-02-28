export function calcElo(myElo: number, opponentElo: number, won: boolean): number {
  const K = 32;
  const expected = 1 / (1 + Math.pow(10, (opponentElo - myElo) / 400));
  const actualScore = won ? 1 : 0;
  return Math.round(myElo + K * (actualScore - expected));
}

export function getEloRank(elo: number): { label: string; emoji: string; color: string } {
  if (elo >= 1600) return { label: "Maître", emoji: "👑", color: "#a855f7" };
  if (elo >= 1400) return { label: "Platine", emoji: "💎", color: "#67e8f9" };
  if (elo >= 1200) return { label: "Or", emoji: "🥇", color: "#facc15" };
  if (elo >= 1000) return { label: "Argent", emoji: "🥈", color: "#cbd5e1" };
  return { label: "Bronze", emoji: "🥉", color: "#d97706" };
}
