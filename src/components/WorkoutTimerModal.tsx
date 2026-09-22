"use client";

import { useState, useEffect } from "react";
import { playWhistleSound } from "@/lib/alarmService";
import { playSquadAudio } from "@/lib/voiceService";
import { Play, Pause, RotateCcw, X, Volume2, ShieldAlert } from "lucide-react";

interface Exercise {
  id: string;
  name: string;
  duration: number; // in seconds
  reps: string;
  instructions: string;
  audioKey: any;
  speechText: string;
}

const ROUTINE_STAGES: Exercise[] = [
  {
    id: "stage-1",
    name: "01. Jogging to PG Ground",
    duration: 1800, // 30 mins
    reps: "30 Min Running/Jogging",
    instructions: "Ghar se PG Ground tak live pacing banaye rakhein. 05:30 AM tak pahunchein!",
    audioKey: "mission_ground",
    speechText: "Mission start! Sabhi members jogging shuru karein aur PG Ground pahunchein.",
  },
  {
    id: "stage-2",
    name: "02. PG Ground Dynamic Warm-up",
    duration: 900, // 15 mins
    reps: "15 Min Stretches",
    instructions: "Jumping Jacks, High knees, arm swings aur hamstring stretches.",
    audioKey: "ground_reached",
    speechText: "PG Ground arrival complete! Ab warm-up aur body stretching shuru karein.",
  },
  {
    id: "stage-3",
    name: "03. Military Push-Ups Sets",
    duration: 1200, // 20 mins
    reps: "4 Sets x 15-20 Reps",
    instructions: "Standard, Wide, Diamond aur Incline Push-ups. Form ekdum straight honi chahiye.",
    audioKey: "pushups_start",
    speechText: "Push-ups training start! Peeth seedhi, chhati zameen ke paas, sets pure karein.",
  },
  {
    id: "stage-4",
    name: "04. Squats & Core Plank Hold",
    duration: 900, // 15 mins
    reps: "Squats + 3x 60s Planks",
    instructions: "Bodyweight squats aur 60-second core planks. Breath steady rakhein.",
    audioKey: "core_squats",
    speechText: "Squats aur Core plank ka waqt hai. Core tight rakhein.",
  },
  {
    id: "stage-5",
    name: "05. Cool-Down & Debrief",
    duration: 600, // 10 mins
    reps: "Recovery & Hydrate",
    instructions: "Deep breathing, hydration aur daily streak celebration.",
    audioKey: "workout_finish",
    speechText: "Mission accomplished! Aaj ka workout aur attendance complete hui. Dismiss!",
  },
];

export default function WorkoutTimerModal({ onClose }: { onClose: () => void }) {
  const [selectedEx, setSelectedEx] = useState<Exercise>(ROUTINE_STAGES[0]);
  const [timeLeft, setTimeLeft] = useState<number>(ROUTINE_STAGES[0].duration);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  useEffect(() => {
    let timer: any = null;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      playWhistleSound();
      playSquadAudio("task_complete", "Stage complete! Shabaash, agle exercise ke liye position lein.");
      if ("vibrate" in navigator) {
        navigator.vibrate([600, 200, 600, 200, 1000]);
      }
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft]);

  const selectStage = (stage: Exercise) => {
    setSelectedEx(stage);
    setTimeLeft(stage.duration);
    setIsRunning(false);
  };

  const toggleTimer = () => {
    if (!isRunning) {
      playSquadAudio(selectedEx.audioKey, selectedEx.speechText);
    }
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(selectedEx.duration);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-zinc-950 border border-amber-500/50 rounded-3xl p-5 flex flex-col shadow-2xl max-h-[92vh]">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-amber-400">
              PG Ground Training Arena
            </h2>
            <p className="text-[10px] text-zinc-400">05:00 AM - 06:30 AM Mandatory Schedule</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg bg-zinc-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Big Timer Card */}
        <div className="my-4 p-5 bg-zinc-900 border border-amber-500/30 rounded-2xl flex flex-col items-center">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest text-center">
            {selectedEx.name}
          </span>
          <div className="text-5xl font-black font-mono tracking-tight text-white my-2">
            {formatTime(timeLeft)}
          </div>
          <p className="text-[11px] text-zinc-400 text-center px-2">{selectedEx.instructions}</p>

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={toggleTimer}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 ${
                isRunning
                  ? "bg-red-500 hover:bg-red-400 text-white"
                  : "bg-amber-500 hover:bg-amber-400 text-black"
              }`}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isRunning ? "Pause Stage" : "Start Stage"}
            </button>

            <button
              onClick={resetTimer}
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => playWhistleSound()}
              className="p-2.5 bg-zinc-800 hover:bg-amber-500 hover:text-black text-amber-400 rounded-xl transition"
              title="Referee Whistle"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <span className="text-[11px] uppercase font-bold text-zinc-400 mb-2">
          Routine Stages (Sequential):
        </span>
        <div className="space-y-2 overflow-y-auto pr-1 flex-1">
          {ROUTINE_STAGES.map((stg, i) => (
            <div
              key={stg.id}
              onClick={() => selectStage(stg)}
              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                selectedEx.id === stg.id
                  ? "bg-amber-500/20 border-amber-500 text-white shadow-lg"
                  : "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
              }`}
            >
              <div>
                <div className="text-xs font-bold">{stg.name}</div>
                <div className="text-[10px] text-zinc-400">{stg.reps}</div>
              </div>
              <span className="text-xs font-mono font-extrabold text-amber-400">
                {Math.floor(stg.duration / 60)} Min
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
