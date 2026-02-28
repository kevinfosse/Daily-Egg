"use client";

import { useState, useEffect, useCallback } from "react";
import { getEloRank } from "@/app/lib/pvp/elo";

interface LeaderboardEntry {
  rank: number;
  username: string;
  value: number;
}

interface LeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const TABS = [
  { key: "totalPokemons", label: "Collection" },
  { key: "totalShinys", label: "Shinys" },
  { key: "bestStreak", label: "Streak" },
  { key: "totalHatched", label: "Eclosions" },
  { key: "pvpElo", label: "⚔️ PvP" },
] as const;

function getRankStyle(rank: number): string {
  if (rank === 1) return "text-yellow-400";
  if (rank === 2) return "text-slate-300";
  if (rank === 3) return "text-amber-600";
  return "text-slate-400";
}

function getRankEmoji(rank: number): string {
  if (rank === 1) return "#1";
  if (rank === 2) return "#2";
  if (rank === 3) return "#3";
  return `#${rank}`;
}

export default function Leaderboard({ isOpen, onClose }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<string>("totalPokemons");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUser, setCurrentUser] = useState<{ rank: number; value: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLeaderboard = useCallback(async (category: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?category=${category}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.leaderboard || []);
        setCurrentUser(data.currentUser || null);
      }
    } catch (e) {
      console.error("Failed to fetch leaderboard:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard(activeTab);
    }
  }, [isOpen, activeTab, fetchLeaderboard]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="pixel-box p-6 w-full max-w-sm max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-[family-name:var(--font-pixel)] text-sm text-yellow-400">
            Classement
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-2 py-1 text-[10px] font-[family-name:var(--font-pixel)] rounded whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? "bg-yellow-400 text-black"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-slate-400 text-sm animate-pulse">Chargement...</p>
        ) : entries.length === 0 ? (
          <p className="text-center text-slate-400 text-sm">Aucun joueur</p>
        ) : (
          <div className="space-y-1">
            {entries.map((entry) => (
              <div
                key={entry.rank}
                className={`flex items-center justify-between px-3 py-2 rounded ${
                  currentUser && entry.rank === currentUser.rank
                    ? "bg-yellow-400/10 border border-yellow-400/30"
                    : "bg-slate-800/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`font-[family-name:var(--font-pixel)] text-xs font-bold w-8 ${getRankStyle(entry.rank)}`}>
                    {getRankEmoji(entry.rank)}
                  </span>
                  <span className="text-white text-xs truncate max-w-[100px]">
                    {entry.username}
                  </span>
                  {activeTab === "pvpElo" && (
                    <span className="font-[family-name:var(--font-pixel)] text-[9px]" style={{ color: getEloRank(entry.value).color }}>
                      {getEloRank(entry.value).emoji} {getEloRank(entry.value).label}
                    </span>
                  )}
                </div>
                <span className="font-[family-name:var(--font-pixel)] text-xs text-yellow-400">
                  {activeTab === "pvpElo" ? `${entry.value} ELO` : entry.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Current user rank if not in top 20 */}
        {currentUser && currentUser.rank > 20 && (
          <div className="mt-4 pt-3 border-t border-slate-700">
            <div className="flex items-center justify-between px-3 py-2 rounded bg-yellow-400/10 border border-yellow-400/30">
              <div className="flex items-center gap-3">
                <span className="font-[family-name:var(--font-pixel)] text-xs font-bold text-slate-400 w-8">
                  #{currentUser.rank}
                </span>
                <span className="text-white text-xs">Toi</span>
              </div>
              <span className="font-[family-name:var(--font-pixel)] text-xs text-yellow-400">
                {currentUser.value}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
