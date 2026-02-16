"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import StarfieldBackground from "../component/StarfieldBackground";

export default function LoginPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.user) {
      router.push("/");
    }
  }, [session, router]);

  const handleGuest = () => {
    try {
      window.localStorage.setItem(
        "pokeDaily.guest.v1",
        JSON.stringify({
          version: 1,
          username: "Invité",
          lastHatchDateIso: null,
          streak: 0,
          bestStreak: 0,
          totalHatchedPokemons: 0,
          totalShinyHatchedPokemons: 0,
          pokemons: [],
        })
      );
    } catch {
      // ignore
    }
    router.push("/");
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, username, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Erreur lors de l'inscription");
          setLoading(false);
          return;
        }
      }

      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        setError("Identifiants invalides.");
        setLoading(false);
        return;
      }

      router.push("/");
    } catch {
      setError("Une erreur est survenue.");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#0a1628] via-[#1a237e] to-[#0d47a1]">
      <StarfieldBackground />

      <div className="relative z-10 mb-6 text-center">
      <h1 className="font-[family-name:var(--font-pixel)] text-lg text-yellow-400 drop-shadow-lg">
      PokéDaily
        </h1>
      </div>

    
      <form
      onSubmit={handleSubmit}
      className="relative z-10 w-full max-w-sm pixel-box p-6 space-y-4"
      >

        {isRegister && (
          <label className="block text-sm text-slate-200">
            Pseudo
            <input
              type="text"
              required
              minLength={3}
              maxLength={20}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full pixel-input px-3 py-2 text-sm text-white"
              />
          </label>
        )}

        <label className="block text-sm text-slate-200">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full pixel-input px-3 py-2 text-sm text-white"
            />
        </label>

        <label className="block text-sm text-slate-200">
          Mot de passe
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full pixel-input px-3 py-2 text-sm text-white"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full pixel-button py-2 text-sm font-bold text-white disabled:opacity-60"
          >
          {loading
            ? isRegister ? "Inscription..." : "Connexion..."
            : isRegister ? "S'inscrire" : "Se connecter"}
        </button>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleGuest}
            className="w-full pixel-button py-2 text-sm font-bold text-white"
          >
            Jouer en invité
          </button>
          <p className="mt-2 text-center font-[family-name:var(--font-pixel)] text-[8px] text-slate-500">
            Mode invité: progression stockée uniquement sur cet appareil.
          </p>
        </div>

        <p className="text-center text-sm text-slate-400">
          {isRegister ? "Déjà un compte ?" : "Pas encore de compte ?"}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="ml-1 text-indigo-400 hover:underline"
          >
            {isRegister ? "Se connecter" : "S'inscrire"}
          </button>
        </p>
      </form>
    </main>
  );
}