"use client";

import { useState, useRef, useEffect } from "react";
import { X, Volume2, VolumeX, Shield } from "lucide-react";

export const SQUAD_RULES = [
  { id: 1, title: "04:30 AM Biometric Window", text: "04:30 se 05:00 AM ke beech face scan karke attendance lock karein. 05:01 AM ke baad entry late mark hogi." },
  { id: 2, title: "24/7 Location Authorization", text: "Squad security aur radar tracking ke liye live location access humesha enable rakhna anivarya hai." },
  { id: 3, title: "PG Ground Jogging Pacing", text: "Subah 05:00 se 05:30 AM tak apne sthan se jogging karte hue seedhe PG Ground pahunchein." },
  { id: 4, title: "Streak Discipline", text: "Lagatar 3 din bina inform kiye gayab rehne par fitness streak reset kar di jayegi." },
  { id: 5, title: "Ground Focus (05:30 - 06:30 AM)", text: "Ground me warmup, pushups aur core workout ke dauran faltu mobile browsing sakht mana hai." },
  { id: 6, title: "Strict SOS Protocols", text: "SOS button sirf real-life emergency me hold karein. Faaltu trigger karne par penalty lagegi." },
  { id: 7, title: "Wake-Up Siren Override", text: "04:45 AM tak check-in na karne par squad member ke phone par high-pitch wake up ping bhej sakti hai." },
  { id: 8, title: "Walkie-Talkie Decorum", text: "Push-to-talk voice note sirf ground raste aur squad update ke liye use karein." },
  { id: 9, title: "Squad Brotherhood & Honor", text: "Sabhi members ek doosre ki fitness aur safety ko priority denge." },
  { id: 10, title: "Mission Dismissal (06:30 AM)", text: "Subah 06:30 AM final whistle ke baad hi session dismiss hoga aur streaks record hongi." },
];

export default function RulesModal({ onClose }: { onClose: () => void }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-play squad_rules.mp3 on modal mount
  useEffect(() => {
    const audio = new Audio("/audio/squad_rules.mp3");
    audioRef.current = audio;

    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);

    audio.play().then(() => {
      setIsPlaying(true);
    }).catch((err) => {
      console.warn("Auto-play blocked or failed:", err);
      setIsPlaying(false);
    });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  const toggleRulesVoice = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center p-3 bg-black/90 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg bg-zinc-950 border border-amber-500/60 rounded-3xl p-5 flex flex-col shadow-2xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-amber-400">
                Squad Rules (10 Niyam)
              </h2>
              <p className="text-[10px] text-zinc-400">Official Operational Guidelines</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white rounded-lg bg-zinc-900">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Audio Toggle Indicator */}
        <div className="my-3">
          <button
            onClick={toggleRulesVoice}
            className={`w-full py-2.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-md ${
              isPlaying
                ? "bg-red-500 hover:bg-red-400 text-white animate-pulse"
                : "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20"
            }`}
          >
            {isPlaying ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            {isPlaying ? "Voice Chalu Hai (Tap to Pause/Stop)" : "Voice Dobara Suniye (Play)"}
          </button>
        </div>

        {/* 10 Rules Scroll List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 my-1">
          {SQUAD_RULES.map((r) => (
            <div key={r.id} className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-start gap-3">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-mono text-xs font-bold flex-shrink-0">
                {r.id.toString().padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-xs font-bold text-zinc-200">{r.title}</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{r.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
