export type SquadAudioType =
  | "welcome"
  | "denied"
  | "sos"
  | "wake_up"
  | "mission_ground"
  | "ground_reached"
  | "pushups_start"
  | "core_squats"
  | "rest_timer"
  | "task_complete"
  | "navigation"
  | "workout_finish"
  | "proximity_alert"
  | "squad_rules";

let currentAudio: HTMLAudioElement | null = null;

export const playSquadAudio = (
  audioName: SquadAudioType,
  speechFallbackText?: string
) => {
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    const audio = new Audio(`/audio/${audioName}.mp3`);
    currentAudio = audio;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn(`Audio ${audioName}.mp3 fallback trigger:`, err);
        if (speechFallbackText && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(speechFallbackText);
          utterance.lang = "hi-IN";
          utterance.pitch = 0.8;
          utterance.rate = 0.9;
          window.speechSynthesis.speak(utterance);
        }
      });
    }
  } catch (e) {
    console.warn("Audio service error:", e);
  }
};

export const speakMemberName = (memberName: string, distanceMeters: number) => {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const text = `Yeh ${memberName} hain. Doori lagbhag ${Math.round(distanceMeters)} meter hai.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "hi-IN";
    utterance.pitch = 0.9;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }
};
