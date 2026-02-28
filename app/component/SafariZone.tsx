"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface SafariState {
  options: string[];
  attemptsLeft: number;
  streak: number;
  hasChallenge: boolean;
  message?: string;
}

interface SafariResult {
  correct: boolean;
  correctName: string;
  spriteUrl: string;
  candyEarned: number;
  bonusEggEarned: boolean;
  mysteryTicketEarned: boolean;
  streak: number;
  attemptsLeft: number;
}

interface SafariZoneProps {
  isOpen: boolean;
  onClose: () => void;
  onRewardClaimed: (updates: { candy: number }) => void;
}

export default function SafariZone({ isOpen, onClose, onRewardClaimed }: SafariZoneProps) {
  const [phase, setPhase] = useState<"intro" | "guessing" | "revealed">("intro");
  const [safariState, setSafariState] = useState<SafariState | null>(null);
  const [result, setResult] = useState<SafariResult | null>(null);
  const [silhouetteUrl, setSilhouetteUrl] = useState<string | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [loadingGuess, setLoadingGuess] = useState(false);
  const [cryUnavailable, setCryUnavailable] = useState(false);
  const [playCryLoading, setPlayCryLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadChallenge = useCallback(async () => {
    setLoadingChallenge(true);
    setSilhouetteUrl(null);
    try {
      const res = await fetch("/api/safari");
      const data = await res.json();
      setSafariState(data);
      if (data.hasChallenge) {
        setPhase("guessing");
        await buildSilhouette();
      }
    } catch {
      // silent
    } finally {
      setLoadingChallenge(false);
    }
  }, []);

  async function buildSilhouette() {
    setSilhouetteUrl(null);
    // Fetch sprite via proxy (same-origin, no CORS)
    try {
      const res = await fetch("/api/safari/sprite");
      if (!res.ok) return;
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        // Step 1 — draw blurred image onto a full-size canvas to soften edges
        const blurCanvas = document.createElement("canvas");
        blurCanvas.width = img.width;
        blurCanvas.height = img.height;
        const blurCtx = blurCanvas.getContext("2d");
        if (!blurCtx) return;
        blurCtx.filter = "blur(4px)";
        blurCtx.drawImage(img, 0, 0);
        blurCtx.filter = "none";

        // Step 2 — paint blurred result onto a tiny canvas (pixelation: 32×32)
        const SMALL = 32;
        const smallCanvas = document.createElement("canvas");
        smallCanvas.width = SMALL;
        smallCanvas.height = SMALL;
        const smallCtx = smallCanvas.getContext("2d");
        if (!smallCtx) return;
        smallCtx.drawImage(blurCanvas, 0, 0, SMALL, SMALL);

        // Step 3 — blacken every non-transparent pixel on the small canvas
        const imageData = smallCtx.getImageData(0, 0, SMALL, SMALL);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 10) {
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 255;
          }
        }
        smallCtx.putImageData(imageData, 0, 0);

        // Step 4 — scale back up to display size with pixelated rendering
        const OUTPUT = 120;
        const outCanvas = document.createElement("canvas");
        outCanvas.width = OUTPUT;
        outCanvas.height = OUTPUT;
        const outCtx = outCanvas.getContext("2d");
        if (!outCtx) return;
        outCtx.imageSmoothingEnabled = false; // keeps the blocky pixelated look
        outCtx.drawImage(smallCanvas, 0, 0, OUTPUT, OUTPUT);

        setSilhouetteUrl(outCanvas.toDataURL("image/png"));
        URL.revokeObjectURL(blobUrl);
      };
      img.src = blobUrl;
    } catch {
      // silent
    }
  }

  const handlePlayCry = async () => {
    if (playCryLoading) return;
    setPlayCryLoading(true);
    try {
      const res = await fetch("/api/safari/cry");
      if (!res.ok) {
        setCryUnavailable(true);
        return;
      }
      const blob = await res.blob();
      if (blob.type.includes("ogg") || blob.size > 0) {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.play().catch(() => setCryUnavailable(true));
        audio.onended = () => URL.revokeObjectURL(url);
      } else {
        setCryUnavailable(true);
      }
    } catch {
      setCryUnavailable(true);
    } finally {
      setPlayCryLoading(false);
    }
  };

  const handleGuess = async (guess: string) => {
    if (loadingGuess) return;
    setLoadingGuess(true);
    try {
      const res = await fetch("/api/safari/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guess }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Erreur");
        return;
      }
      setResult(data);
      setPhase("revealed");
      if (data.candyEarned > 0) {
        onRewardClaimed({ candy: data.candyEarned });
      }
    } catch {
      alert("Erreur réseau");
    } finally {
      setLoadingGuess(false);
    }
  };

  const handleNext = async () => {
    setResult(null);
    setSilhouetteUrl(null);
    setCryUnavailable(false);
    await loadChallenge();
  };

  useEffect(() => {
    if (!isOpen) return;
    setPhase("intro");
    setResult(null);
    setSilhouetteUrl(null);
    setCryUnavailable(false);
    // Load state on open
    fetch("/api/safari")
      .then((r) => r.json())
      .then((data) => setSafariState(data))
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div
        className="w-full max-w-sm rounded-t-2xl flex flex-col"
        style={{
          background: "linear-gradient(180deg, #0f1a0f 0%, #1a3a1a 100%)",
          border: "1px solid rgba(34,197,94,0.3)",
          maxHeight: "90vh",
          animation: "slideUp 0.3s ease-out",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div>
            <h2 className="font-[family-name:var(--font-pixel)] text-[11px] text-green-400">
              🌿 Safari Zone
            </h2>
            {safariState && (
              <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 mt-0.5">
                Qui est ce Pokémon ?
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">

          {/* INTRO PHASE */}
          {phase === "intro" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-4xl">🌿</div>
              <div className="text-center">
                <p className="font-[family-name:var(--font-pixel)] text-[10px] text-green-300 mb-2">
                  Bienvenue dans la Safari Zone !
                </p>
                <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 mb-1">
                  Identifiez le Pokémon grâce à sa silhouette et son cri.
                </p>
                {safariState && (
                  <div className="mt-3 flex gap-4 justify-center">
                    <div className="text-center">
                      <p className="font-[family-name:var(--font-pixel)] text-[9px] text-white">{safariState.attemptsLeft}</p>
                      <p className="font-[family-name:var(--font-pixel)] text-[7px] text-slate-400">tentatives</p>
                    </div>
                    <div className="text-center">
                      <p className="font-[family-name:var(--font-pixel)] text-[9px] text-yellow-400">{safariState.streak} 🔥</p>
                      <p className="font-[family-name:var(--font-pixel)] text-[7px] text-slate-400">streak</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Reward table */}
              <div className="w-full rounded-lg p-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <p className="font-[family-name:var(--font-pixel)] text-[8px] text-green-400 mb-2">Récompenses :</p>
                <div className="space-y-1">
                  {[
                    { label: "Bonne réponse", reward: "+20 🍬" },
                    { label: "Streak ×3", reward: "+1 🥚 Œuf Bonus" },
                    { label: "Streak ×5", reward: "+1 🎫 Ticket Mystère" },
                  ].map((r) => (
                    <div key={r.label} className="flex justify-between">
                      <span className="font-[family-name:var(--font-pixel)] text-[7px] text-slate-400">{r.label}</span>
                      <span className="font-[family-name:var(--font-pixel)] text-[7px] text-green-300">{r.reward}</span>
                    </div>
                  ))}
                </div>
              </div>

              {safariState?.attemptsLeft === 0 ? (
                <div className="text-center">
                  <p className="font-[family-name:var(--font-pixel)] text-[9px] text-red-400">Tentatives épuisées pour aujourd'hui !</p>
                  <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400 mt-1">Revenez demain.</p>
                </div>
              ) : (
                <button
                  onClick={loadChallenge}
                  disabled={loadingChallenge}
                  className="w-full py-3 rounded-xl font-[family-name:var(--font-pixel)] text-[9px] text-white disabled:opacity-50"
                  style={{ background: "rgba(34,197,94,0.4)", border: "1px solid #22c55e" }}
                >
                  {loadingChallenge ? "Chargement..." : "🌿 Partir à l'aventure !"}
                </button>
              )}
            </div>
          )}

          {/* GUESSING PHASE */}
          {phase === "guessing" && safariState && (
            <div className="flex flex-col items-center gap-4">
              {/* Stats */}
              <div className="w-full flex justify-between">
                <span className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-400">
                  {safariState.attemptsLeft} tentative{safariState.attemptsLeft !== 1 ? "s" : ""} restante{safariState.attemptsLeft !== 1 ? "s" : ""}
                </span>
                <span className="font-[family-name:var(--font-pixel)] text-[8px] text-yellow-400">
                  {safariState.streak} 🔥 streak
                </span>
              </div>

              {/* Silhouette */}
              <div
                className="flex items-center justify-center rounded-xl"
                style={{
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(34,197,94,0.3)",
                  width: "160px",
                  height: "160px",
                }}
              >
                {silhouetteUrl ? (
                  <img
                    src={silhouetteUrl}
                    alt="???"
                    style={{ width: "120px", height: "120px", imageRendering: "pixelated", objectFit: "contain" }}
                  />
                ) : (
                  <p className="font-[family-name:var(--font-pixel)] text-[8px] text-slate-500 animate-pulse">Chargement...</p>
                )}
              </div>

              {/* Cry button */}
              <button
                onClick={handlePlayCry}
                disabled={cryUnavailable || playCryLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-[family-name:var(--font-pixel)] text-[9px] disabled:opacity-40"
                style={{
                  background: cryUnavailable ? "rgba(255,255,255,0.05)" : "rgba(34,197,94,0.2)",
                  border: `1px solid ${cryUnavailable ? "rgba(255,255,255,0.1)" : "#22c55e"}`,
                  color: cryUnavailable ? "#64748b" : "#4ade80",
                }}
              >
                {playCryLoading ? "..." : "🔊"}
                <span>{cryUnavailable ? "Son non disponible" : playCryLoading ? "Chargement..." : "Écouter le cri"}</span>
              </button>

              {/* Choice buttons */}
              <div className="w-full grid grid-cols-2 gap-2">
                {safariState.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleGuess(option)}
                    disabled={loadingGuess}
                    className="py-3 px-2 rounded-xl font-[family-name:var(--font-pixel)] text-[9px] text-white text-center capitalize disabled:opacity-50 transition-all hover:brightness-110 active:scale-95"
                    style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.5)" }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* REVEALED PHASE */}
          {phase === "revealed" && result && (
            <div className="flex flex-col items-center gap-4 py-2">
              {/* Result banner */}
              <div
                className="w-full px-4 py-3 rounded-xl text-center"
                style={{
                  background: result.correct ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                  border: `1px solid ${result.correct ? "#22c55e" : "#ef4444"}`,
                }}
              >
                <p className="font-[family-name:var(--font-pixel)] text-sm mb-1" style={{ color: result.correct ? "#4ade80" : "#f87171" }}>
                  {result.correct ? "✅ Bravo !" : "❌ Raté !"}
                </p>
                <p className="font-[family-name:var(--font-pixel)] text-[8px] text-white capitalize">
                  C'était : <span className="text-yellow-300">{result.correctName}</span>
                </p>
              </div>

              {/* Revealed sprite */}
              <div
                className="flex items-center justify-center rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  width: "140px",
                  height: "140px",
                }}
              >
                <img
                  src={result.spriteUrl}
                  alt={result.correctName}
                  style={{ width: "112px", height: "112px", imageRendering: "pixelated", objectFit: "contain" }}
                />
              </div>

              {/* Rewards */}
              {(result.candyEarned > 0 || result.bonusEggEarned || result.mysteryTicketEarned) && (
                <div className="w-full rounded-xl p-3" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}>
                  <p className="font-[family-name:var(--font-pixel)] text-[8px] text-green-400 mb-2 text-center">Récompenses !</p>
                  <div className="flex flex-col gap-1">
                    {result.candyEarned > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-base">🍬</span>
                        <span className="font-[family-name:var(--font-pixel)] text-[9px] text-white">+{result.candyEarned} Candy</span>
                      </div>
                    )}
                    {result.bonusEggEarned && (
                      <div className="flex items-center gap-2">
                        <span className="text-base">🥚</span>
                        <span className="font-[family-name:var(--font-pixel)] text-[9px] text-white">+1 Œuf Bonus (streak ×3 !)</span>
                      </div>
                    )}
                    {result.mysteryTicketEarned && (
                      <div className="flex items-center gap-2">
                        <span className="text-base">🎫</span>
                        <span className="font-[family-name:var(--font-pixel)] text-[9px] text-yellow-300">+1 Ticket Mystère (streak ×5 !)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Streak display */}
              <div className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-pixel)] text-[9px] text-slate-400">Streak :</span>
                <span className="font-[family-name:var(--font-pixel)] text-[9px] text-yellow-400">{result.streak} 🔥</span>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 w-full">
                {result.attemptsLeft > 0 ? (
                  <button
                    onClick={handleNext}
                    disabled={loadingChallenge}
                    className="flex-1 py-2 rounded-xl font-[family-name:var(--font-pixel)] text-[9px] text-white disabled:opacity-50"
                    style={{ background: "rgba(34,197,94,0.4)", border: "1px solid #22c55e" }}
                  >
                    {loadingChallenge ? "Chargement..." : `Prochain (${result.attemptsLeft} restante${result.attemptsLeft !== 1 ? "s" : ""})`}
                  </button>
                ) : (
                  <div className="flex-1 text-center">
                    <p className="font-[family-name:var(--font-pixel)] text-[8px] text-red-400">Plus de tentatives aujourd'hui !</p>
                  </div>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl font-[family-name:var(--font-pixel)] text-[9px] text-slate-300"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
