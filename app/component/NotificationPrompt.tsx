"use client";

import { useState, useEffect } from "react";
import { useServiceWorker } from "@/app/hooks/useServiceWorker";

interface NotificationPromptProps {
  delay?: number; // Delay before showing in ms
}

export default function NotificationPrompt({ delay = 3000 }: NotificationPromptProps) {
  const { isSupported, isSubscribed, permission, subscribe } = useServiceWorker();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed in this session
    const wasDismissed = sessionStorage.getItem("notification-prompt-dismissed");
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    // Show prompt after delay
    const timer = setTimeout(() => {
      if (isSupported && !isSubscribed && permission !== "denied") {
        setVisible(true);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [isSupported, isSubscribed, permission, delay]);

  const handleEnable = async () => {
    setLoading(true);
    const success = await subscribe();
    setLoading(false);
    if (success) {
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    sessionStorage.setItem("notification-prompt-dismissed", "true");
  };

  if (!visible || dismissed || isSubscribed || permission === "denied") {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto animate-slide-up">
      <div className="pixel-box p-4">
        <div className="flex items-start gap-3">
          {/* Bell icon */}
          <div className="flex-shrink-0 w-10 h-10 bg-yellow-400/20 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </div>

          <div className="flex-1">
            <h3 className="font-[family-name:var(--font-pixel)] text-xs text-yellow-400 mb-1">
              Notifications
            </h3>
            <p className="text-slate-300 text-sm mb-3">
              Recevoir une alerte quand votre oeuf est pret ?
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleEnable}
                disabled={loading}
                className="pixel-button px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {loading ? "..." : "Activer"}
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
