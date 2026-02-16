"use client";

import useSWR from 'swr';
import { useState, useEffect, useRef } from 'react';

// Interface des données
interface ActivityLog {
  _id: string;
  message: string;
  pokemonName?: string;
  createdAt: string;
}

// Fetcher simple
const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Petit composant SVG pour la Pokéball en pixel art
const PixelPokeball = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-spin-slow">
    <rect x="2" y="2" width="12" height="12" rx="6" fill="#F0F0F0"/> {/* Fond Blanc */}
    <path d="M2 8H14" stroke="black" strokeWidth="2"/> {/* Ligne milieu */}
    <path d="M2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8" fill="#FF0000"/> {/* Haut Rouge */}
    <circle cx="8" cy="8" r="2" fill="white" stroke="black" strokeWidth="2"/> {/* Bouton central */}
  </svg>
);

export default function NotificationBar() {
  // Polling toutes les 5 secondes
  const { data: logs } = useSWR<ActivityLog[]>('/api/activity', fetcher, { 
    refreshInterval: 5000 
  });

  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const lastShownId = useRef<string | null>(null);

  useEffect(() => {
    if (logs && logs.length > 0) {
      const latestLog = logs[0];
      
      // On affiche seulement si c'est un nouveau message
      if (latestLog._id !== lastShownId.current) {
        setCurrentMessage(latestLog.message);
        lastShownId.current = latestLog._id;

        // Le message reste affiché 4 secondes
        const timer = setTimeout(() => {
            setCurrentMessage(null);
        }, 4000);

        return () => clearTimeout(timer);
      }
    }
  }, [logs]);

  // Si pas de message, on rend une div vide pour garder l'espace (optionnel) ou null
  if (!currentMessage) return <div className="h-8 mb-6"></div>;

  return (
    // Container fluide qui prend la place mais sans bordure
    <div className="w-full max-w-sm mb-6 flex justify-center animate-in fade-in slide-in-from-top-2 duration-500">
      
      <div className="
        flex items-center gap-3 px-4 py-1.5
        bg-black/40 backdrop-blur-sm rounded-full
        text-white/90
        font-[family-name:var(--font-pixel)] text-[10px] tracking-wide
      ">
        {/* Pokéball gauche */}
        <PixelPokeball />

        {/* Message */}
        <span>{currentMessage}</span>

        {/* Pokéball droite */}
        <PixelPokeball />
      </div>

    </div>
  );
}