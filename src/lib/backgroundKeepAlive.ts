// Background Audio Loop to prevent Android OS from killing PWA
let backgroundAudioContext: AudioContext | null = null;

export const enableBackgroundPersistence = () => {
  try {
    if (!backgroundAudioContext) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      backgroundAudioContext = new AudioCtx();

      // Silent oscillator (Inaudible background stream)
      const osc = backgroundAudioContext.createOscillator();
      const gain = backgroundAudioContext.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(1, backgroundAudioContext.currentTime); // Inaudible 1Hz
      gain.gain.setValueAtTime(0.001, backgroundAudioContext.currentTime);

      osc.connect(gain);
      gain.connect(backgroundAudioContext.destination);
      osc.start();
    }

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Golden Eagle Squad Active",
        artist: "Radar & Background Sync ON",
        album: "PG Ground Routine",
      });
    }
  } catch (e) {
    console.warn("Background persistence warning:", e);
  }
};
