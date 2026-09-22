"use client";

import { useState, useEffect } from "react";
import { Download, ShieldCheck, Star, Radio, Zap, CheckCircle2, X } from "lucide-react";

export default function AppStoreInstallModal({ onBypass }: { onBypass: () => void }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      setIsInstalling(true);
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        onBypass();
      }
      setDeferredPrompt(null);
      setIsInstalling(false);
    } else {
      alert("Installation shortcut:\nChrome ke top 3-dots (⋮) par tap karein aur 'Add to Home screen' ya 'Install App' chunein!");
    }
  };

  return (
    <div className="fixed inset-0 z-[20000] bg-zinc-950 flex flex-col justify-between p-5 text-white overflow-y-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-mono tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
            Official Squad Terminal
          </span>
        </div>
        <button
          onClick={onBypass}
          className="text-xs text-zinc-400 hover:text-zinc-200 underline font-mono"
        >
          Browser Mode ↗
        </button>
      </div>

      {/* App Store Card Info */}
      <div className="my-auto flex flex-col items-center text-center py-6">
        <div className="relative w-28 h-28 rounded-3xl bg-zinc-900 border-2 border-amber-500/70 p-3 shadow-[0_0_40px_rgba(245,158,11,0.25)] flex items-center justify-center mb-4">
          <span className="text-6xl">🦅</span>
          <span className="absolute -bottom-2 -right-2 bg-emerald-500 text-black p-1 rounded-full border-2 border-zinc-950">
            <CheckCircle2 className="w-4 h-4" />
          </span>
        </div>

        <h1 className="text-2xl font-black uppercase tracking-wider text-white">
          Golden Eagle Squad
        </h1>
        <p className="text-xs text-amber-400 font-semibold mt-0.5">
          High-Security Fitness & Radar Hub
        </p>

        {/* Store Metrics */}
        <div className="flex items-center gap-6 mt-6 py-3 px-6 bg-zinc-900/80 border border-zinc-800 rounded-2xl">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-amber-400 font-black text-sm">
              <span>5.0</span>
              <Star className="w-3.5 h-3.5 fill-amber-400" />
            </div>
            <span className="text-[9px] text-zinc-400 uppercase tracking-wider">Squad Rated</span>
          </div>
          <div className="w-[1px] h-7 bg-zinc-800" />
          <div className="flex flex-col items-center">
            <span className="text-sm font-black text-white font-mono">4.2 MB</span>
            <span className="text-[9px] text-zinc-400 uppercase tracking-wider">Lightweight</span>
          </div>
          <div className="w-[1px] h-7 bg-zinc-800" />
          <div className="flex flex-col items-center">
            <span className="text-sm font-black text-emerald-400 uppercase">PWA APK</span>
            <span className="text-[9px] text-zinc-400 uppercase tracking-wider">No PlayStore</span>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="w-full max-w-sm space-y-2 mt-6 text-left">
          <div className="flex items-center gap-3 p-2.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
            <ShieldCheck className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-zinc-200">Biometric Access Gate</div>
              <div className="text-[10px] text-zinc-400">Strict facial ID matching via camera.</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-2.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
            <Radio className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-zinc-200">HD Satellite Live Radar</div>
              <div className="text-[10px] text-zinc-400">24/7 continuous squad coordinate sync.</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-2.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
            <Zap className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-zinc-200">04:30 AM Routine & Whistle Timer</div>
              <div className="text-[10px] text-zinc-400">Ambikapur PG Ground arrival enforcement.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-sm mx-auto space-y-2 pb-2">
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          className="w-full py-4 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-black text-sm uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 transition disabled:opacity-50"
        >
          <Download className="w-5 h-5" />
          {isInstalling ? "Installing to Device..." : "Install Squad App (Free)"}
        </button>

        <button
          onClick={onBypass}
          className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-bold rounded-xl transition"
        >
          Browser Me Chalu Rakhein
        </button>
      </div>
    </div>
  );
}
