// Real Referee Sports Whistle Generator using Web Audio API
export const playWhistleSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Dual-tone whistle frequency (high pitch oscillating sound)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";

    // Standard referee whistle pitches (~2800 Hz & 2950 Hz)
    osc1.frequency.setValueAtTime(2800, ctx.currentTime);
    osc2.frequency.setValueAtTime(2950, ctx.currentTime);

    // Whistle pulsation effect
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();

    setTimeout(() => {
      osc1.stop();
      osc2.stop();
      ctx.close();
    }, 1200);
  } catch (e) {
    console.warn("Whistle audio error:", e);
  }
};

// Android Safe Alarm & Vibration (Fixed TypeError)
export const triggerAlarmVibration = async (title: string, message: string, urgent: boolean = false) => {
  // 1. Mobile Physical Vibration
  if ("vibrate" in navigator) {
    navigator.vibrate([400, 200, 400, 200, 800]);
  }

  // 2. Play Whistle Sound
  playWhistleSound();

  // 3. Android Chrome Safe Notification (via Service Worker)
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && "Notification" in window && Notification.permission === "granted") {
        reg.showNotification(title, ({
          body: message,
          vibrate: [500, 250, 500, 250, 1000],
          tag: "golden-alarm", // fixed vibrate type
        } as any);
        return;
      }
    }
  } catch (err) {
    console.warn("Notification error:", err);
  }
};
