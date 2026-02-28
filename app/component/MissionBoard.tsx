"use client";

import { useState, useEffect, useCallback } from "react";

interface Mission {
  type: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  rewardType: "bonusEgg" | "mysteryTicket" | "item";
  rewardAmount: number;
  rewardItemId?: string;
}

interface MissionBoardProps {
  isOpen: boolean;
  onClose: () => void;
  onRewardClaimed?: () => void;
}

function formatCountdown(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function MissionBoard({ isOpen, onClose, onRewardClaimed }: MissionBoardProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [msUntilReset, setMsUntilReset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claimingIndex, setClaimingIndex] = useState<number | null>(null);

  const fetchMissions = useCallback(async () => {
    try {
      const res = await fetch("/api/missions");
      if (res.ok) {
        const data = await res.json();
        setMissions(data.missions || []);
        setMsUntilReset(data.msUntilReset || 0);
      }
    } catch (e) {
      console.error("Failed to fetch missions:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchMissions();
    }
  }, [isOpen, fetchMissions]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || msUntilReset <= 0) return;
    const interval = setInterval(() => {
      setMsUntilReset((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, msUntilReset]);

  const handleClaim = async (index: number) => {
    setClaimingIndex(index);
    try {
      const res = await fetch("/api/missions/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missionIndex: index }),
      });
      if (res.ok) {
        const data = await res.json();
        setMissions(data.missions || []);
        onRewardClaimed?.();
      }
    } catch (e) {
      console.error("Failed to claim:", e);
    } finally {
      setClaimingIndex(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="pixel-box p-6 w-full max-w-sm max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-[family-name:var(--font-pixel)] text-sm text-yellow-400">
            Missions du jour
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg"
          >
            &times;
          </button>
        </div>

        {/* Countdown */}
        <p className="font-[family-name:var(--font-pixel)] text-[10px] text-slate-400 text-center mb-4">
          Reset dans {formatCountdown(msUntilReset)}
        </p>

        {loading ? (
          <p className="text-center text-slate-400 text-sm animate-pulse">Chargement...</p>
        ) : missions.length === 0 ? (
          <p className="text-center text-slate-400 text-sm">Aucune mission disponible</p>
        ) : (
          <div className="space-y-3">
            {missions.map((mission, i) => (
              <div key={i} className="pixel-box p-3">
                <p className="text-white text-xs mb-2">{mission.description}</p>

                {/* Progress bar */}
                <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (mission.progress / mission.target) * 100)}%`,
                      backgroundColor: mission.completed ? "#22c55e" : "#f59e0b",
                    }}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-[family-name:var(--font-pixel)] text-[10px] text-slate-400 flex items-center gap-1">
                    {mission.progress}/{mission.target} —{" "}
                    {mission.rewardType === "bonusEgg" && (
                      <>
                        <img
                          src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lucky-egg.png"
                          alt=""
                          className="inline w-4 h-4"
                          style={{ imageRendering: "pixelated" }}
                        />
                        ×{mission.rewardAmount}
                      </>
                    )}
                    {mission.rewardType === "mysteryTicket" && (
                      <>
                        <img
                          src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png"
                          alt=""
                          className="inline w-4 h-4"
                          style={{ imageRendering: "pixelated" }}
                        />
                        ×{mission.rewardAmount}
                      </>
                    )}
                    {mission.rewardType === "item" && (
                      <span className="text-green-400">Encens Rare 🌿</span>
                    )}
                  </span>

                  {mission.completed && !mission.claimed && (
                    <button
                      onClick={() => handleClaim(i)}
                      disabled={claimingIndex === i}
                      className="px-3 py-1 text-[10px] font-bold text-black bg-yellow-400 rounded hover:bg-yellow-300 disabled:opacity-50 font-[family-name:var(--font-pixel)]"
                    >
                      {claimingIndex === i ? "..." : "CLAIM"}
                    </button>
                  )}

                  {mission.claimed && (
                    <span className="font-[family-name:var(--font-pixel)] text-[10px] text-green-400">
                      OK
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
