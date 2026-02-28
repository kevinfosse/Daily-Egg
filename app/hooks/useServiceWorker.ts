"use client";

import { useState, useEffect, useCallback } from "react";

interface UseServiceWorkerReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  registration: ServiceWorkerRegistration | null;
  permission: NotificationPermission | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  requestPermission: () => Promise<NotificationPermission>;
}

// VAPID public key from environment
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

export function useServiceWorker(): UseServiceWorkerReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  // Check support and register service worker
  useEffect(() => {
    const checkSupport = async () => {
      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      setIsSupported(supported);

      if (!supported) return;

      setPermission(Notification.permission);

      try {
        // Register service worker
        const reg = await navigator.serviceWorker.register("/sw.js");
        setRegistration(reg);

        // Check if already subscribed
        const subscription = await reg.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }
    };

    checkSupport();
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) return "denied";

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!registration || !VAPID_PUBLIC_KEY) {
      console.error("No registration or VAPID key");
      return false;
    }

    try {
      // Request permission if not granted
      if (Notification.permission !== "granted") {
        const perm = await requestPermission();
        if (perm !== "granted") return false;
      }

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Send subscription to server
      const p256dhKey = subscription.getKey("p256dh");
      const authKey = subscription.getKey("auth");

      if (!p256dhKey || !authKey) {
        console.error("Missing subscription keys");
        return false;
      }

      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(
              String.fromCharCode(...new Uint8Array(p256dhKey))
            ),
            auth: btoa(
              String.fromCharCode(...new Uint8Array(authKey))
            ),
          },
        }),
      });

      if (response.ok) {
        setIsSubscribed(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Subscribe failed:", error);
      return false;
    }
  }, [registration, requestPermission]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!registration) return false;

    try {
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setIsSubscribed(false);
        return true;
      }

      // Unsubscribe from server
      await fetch("/api/notifications/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      // Unsubscribe from push manager
      await subscription.unsubscribe();
      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error("Unsubscribe failed:", error);
      return false;
    }
  }, [registration]);

  return {
    isSupported,
    isSubscribed,
    registration,
    permission,
    subscribe,
    unsubscribe,
    requestPermission,
  };
}
