"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import { TEAM_MEMBERS as STATIC_MEMBERS } from "@/lib/members";
import { triggerAlarmVibration, playWhistleSound } from "@/lib/alarmService";
import { playSquadAudio, speakMemberName } from "@/lib/voiceService";
import { enableBackgroundPersistence } from "@/lib/backgroundKeepAlive";
import WorkoutTimerModal from "@/components/WorkoutTimerModal";
import AddMemberModal from "@/components/AddMemberModal";
import RulesModal from "@/components/RulesModal";
import AppStoreInstallModal from "@/components/AppStoreInstallModal";
import { 
  Camera, Send, Sparkles, ShieldCheck, LogOut, 
  MapPin, MessageSquare, Dumbbell, Bell, Flame, 
  ChevronRight, AlertOctagon, Trophy, Award, CheckCircle2,
  UserPlus, Mic, BatteryCharging, Volume2, Radio, BookOpen, X, Navigation,
  Image as ImageIcon, Loader2
} from "lucide-react";

const TeamMap = dynamic(() => import("@/components/TeamMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-zinc-950 text-amber-400 font-medium text-xs">
      HD Satellite Radar load ho raha hai...
    </div>
  ),
});

interface Message {
  id?: number;
  sender: string;
  text: string;
  time: string;
  is_sos?: boolean;
  is_system?: boolean;
  audio_url?: string;
  image_url?: string;
}

interface UserLocation {
  name: string;
  lat: number;
  lng: number;
  time: string;
  photoUrl?: string;
  distanceCoveredKm?: number;
}

interface AttendanceRecord {
  name: string;
  time: string;
  streak: number;
  lastActiveDate?: string;
}

interface DynamicMember {
  name: string;
  photoUrl: string;
}

interface NearbyAlert {
  name: string;
  distanceMeters: number;
  photoUrl?: string;
}

const PG_GROUND_COORDS = { lat: 23.1205, lng: 83.1950 };

const FITNESS_SCHEDULE = [
  { time: "04:30", title: "Wake Up & Biometric Check-in (04:30-05:00)", desc: "Squad uthne ka waqt ho gaya hai! Attendance register karein.", icon: "⏰", audio: "wake_up" },
  { time: "05:00", title: "Jogging to PG Ground", desc: "05:00 se 05:30 tak daudte hue PG Ground pahunchein. Timer open karein.", icon: "🏃", hasTimer: true, audio: "mission_ground" },
  { time: "05:30", title: "PG Ground Warm-up & Push-ups", desc: "Dynamic stretching aur military push-up training.", icon: "🔥", hasTimer: true, audio: "ground_reached" },
  { time: "06:30", title: "Workout Complete & Dismiss", desc: "Cool-down, streaks update aur daily attendance complete.", icon: "💪", audio: "workout_finish" },
];

export default function GoldenEagleHub() {
  const [isStandalone, setIsStandalone] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"map" | "schedule" | "leaderboard" | "chat">("map");
  const [status, setStatus] = useState<string>("Face biometric engine load ho raha hai...");
  const [isScanning, setIsScanning] = useState(false);
  const [cameraCountdown, setCameraCountdown] = useState<number | null>(null);
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [sosHolding, setSosHolding] = useState(false);
  const [hasReachedGround, setHasReachedGround] = useState(false);
  const [groundBatteryMode, setGroundBatteryMode] = useState(false);
  const [isLocationAllowed24x7, setIsLocationAllowed24x7] = useState(false);

  const [nearbyMember, setNearbyMember] = useState<NearbyAlert | null>(null);
  const alertedNearbyMembersRef = useRef<Set<string>>(new Set());

  const [allMembers, setAllMembers] = useState<DynamicMember[]>(STATIC_MEMBERS);
  const [leaderboard, setLeaderboard] = useState<Record<string, AttendanceRecord>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [locations, setLocations] = useState<Record<string, UserLocation>>({});

  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const faceApiRef = useRef<any>(null);
  const labeledDescriptorsRef = useRef<any[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const lastTriggeredAlarmRef = useRef<string>("");
  const sosTimerRef = useRef<any>(null);
  const prevCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const totalDistanceRef = useRef<number>(0);

  // Standalone PWA detection
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isPwa = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
      const bypassed = sessionStorage.getItem("pwa_bypassed") === "true";
      if (!isPwa && !bypassed) {
        setIsStandalone(false);
      }
    }
  }, []);

  useEffect(() => {
    enableBackgroundPersistence();

    if ("wakeLock" in navigator) {
      (navigator as any).wakeLock.request("screen").catch(() => {});
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("autostart") === "true") {
        setIsModalOpen(true);
        playWhistleSound();
        playSquadAudio("mission_ground", "Mission auto-started via Quick Trigger!");
      }

      window.history.pushState({ page: 1 }, "", "");
      const handleHardwareBack = () => {
        window.history.pushState({ page: 1 }, "", "");
        setIsModalOpen((prev) => {
          if (!prev) {
            playWhistleSound();
            playSquadAudio("mission_ground", "Mission auto-started via Phone Back Button trigger!");
            if ("vibrate" in navigator) navigator.vibrate([400, 200, 400]);
            return true;
          }
          return prev;
        });
      };

      window.addEventListener("popstate", handleHardwareBack);
      return () => window.removeEventListener("popstate", handleHardwareBack);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      const allowed = localStorage.getItem(`squad_loc_allowed_${currentUser.toLowerCase()}`);
      setIsLocationAllowed24x7(allowed === "true");
    }
  }, [currentUser]);

  const toggleLocation24x7 = async () => {
    if (!currentUser) return;
    const newState = !isLocationAllowed24x7;
    setIsLocationAllowed24x7(newState);
    localStorage.setItem(`squad_loc_allowed_${currentUser.toLowerCase()}`, String(newState));

    if (newState && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true });
    }

    await supabase.from("squad_attendance").upsert(
      {
        name: currentUser,
        last_checkin_time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "name" }
    );
  };

  const loadSquadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("squad_registered_members")
        .select("*");

      if (!error && data) {
        const dynamicList: DynamicMember[] = data.map((d: any) => ({
          name: d.name,
          photoUrl: d.photo_url,
        }));

        const map = new Map<string, DynamicMember>();
        STATIC_MEMBERS.forEach((m) => map.set(m.name.toLowerCase(), m));
        dynamicList.forEach((m) => map.set(m.name.toLowerCase(), m));

        const combined = Array.from(map.values());
        setAllMembers(combined);
        precomputeDescriptors(combined);
      }
    } catch (e) {
      console.warn("Could not load dynamic members:", e);
    }
  };

  useEffect(() => {
    loadSquadMembers();
  }, []);

  const precomputeDescriptors = async (membersList: DynamicMember[]) => {
    const faceapi = faceApiRef.current;
    if (!faceapi) return;

    const descriptors: any[] = [];
    for (const member of membersList) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = member.photoUrl;
        await new Promise((resolve, reject) => {
          img.onload = () => resolve(true);
          img.onerror = () => reject(new Error());
        });
        const detections = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
          .withFaceLandmarks(true)
          .withFaceDescriptor();

        if (detections) {
          descriptors.push(new faceapi.LabeledFaceDescriptors(member.name, [detections.descriptor]));
        }
      } catch (e) {
        console.warn(`Precompute skip: ${member.name}`);
      }
    }
    labeledDescriptorsRef.current = descriptors;
    if (descriptors.length > 0) {
      setStatus("Camera ready! 3 sec auto-scan shuru ho raha hai...");
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: msgData } = await supabase
        .from("squad_messages")
        .select("*")
        .order("id", { ascending: true })
        .limit(50);
      if (msgData) setMessages(msgData);

      const { data: locData } = await supabase.from("squad_locations").select("*");
      if (locData) {
        const locMap: Record<string, UserLocation> = {};
        locData.forEach((row: any) => {
          locMap[row.name] = {
            name: row.name,
            lat: row.lat,
            lng: row.lng,
            time: row.time,
            photoUrl: row.photo_url,
            distanceCoveredKm: row.distance_km,
          };
        });
        setLocations(locMap);
      }

      const { data: attData } = await supabase.from("squad_attendance").select("*");
      const attMap: Record<string, AttendanceRecord> = {};
      if (attData) {
        attData.forEach((row: any) => {
          attMap[row.name] = {
            name: row.name,
            time: row.last_checkin_time || "Not Checked In",
            streak: row.streak || 0,
            lastActiveDate: row.last_checkin_date,
          };
        });
      }
      setLeaderboard(attMap);
    };

    fetchInitialData();

    const locSub = supabase
      .channel("realtime-locations")
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_locations" }, (p: any) => {
        const row = p.new;
        if (row?.name) {
          setLocations((prev) => {
            const updated = {
              ...prev,
              [row.name]: {
                name: row.name,
                lat: row.lat,
                lng: row.lng,
                time: row.time,
                photoUrl: row.photo_url,
                distanceCoveredKm: row.distance_km,
              },
            };

            if (currentUser && row.name.toLowerCase() !== currentUser.toLowerCase() && prev[currentUser]) {
              const myPos = prev[currentUser];
              const dLat = (row.lat - myPos.lat) * 111320;
              const dLon = (row.lng - myPos.lng) * 111320 * Math.cos((myPos.lat * Math.PI) / 180);
              const distMeters = Math.sqrt(dLat * dLat + dLon * dLon);

              if (distMeters <= 150 && !alertedNearbyMembersRef.current.has(row.name)) {
                alertedNearbyMembersRef.current.add(row.name);
                setNearbyMember({
                  name: row.name,
                  distanceMeters: distMeters,
                  photoUrl: row.photo_url,
                });
                playSquadAudio("proximity_alert", "Saavdhan! Aapka squad saathi paas me maujood hai.");
                if ("vibrate" in navigator) navigator.vibrate([300, 150, 300]);
              }
            }

            return updated;
          });
        }
      })
      .subscribe();

    const msgSub = supabase
      .channel("realtime-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "squad_messages" }, (p: any) => {
        const newMsg = p.new;
        setMessages((prev) => [...prev, newMsg]);

        if (newMsg.is_sos) {
          (triggerAlarmVibration as any)(`🚨 SOS: ${newMsg.sender}`, "Emergency alert!", true);
          playSquadAudio("sos");
          setActiveTab("map");
        } else if (newMsg.audio_url) {
          const audio = new Audio(newMsg.audio_url);
          audio.play().catch(() => {});
        }
      })
      .subscribe();

    const pingSub = supabase
      .channel("realtime-pings")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "squad_pings" }, (p: any) => {
        const ping = p.new;
        if (currentUser && ping.target_user.toLowerCase() === currentUser.toLowerCase()) {
          triggerAlarmVibration(`⏰ WAKE UP PING from ${ping.sent_by}`, "Squad bula raha hai! Turant utho!", true);
          playSquadAudio("wake_up");
        }
      })
      .subscribe();

    const attSub = supabase
      .channel("realtime-attendance")
      .on("postgres_changes", { event: "*", schema: "public", table: "squad_attendance" }, (p: any) => {
        const row = p.new;
        if (row?.name) {
          setLeaderboard((prev) => ({
            ...prev,
            [row.name]: {
              name: row.name,
              time: row.last_checkin_time,
              streak: row.streak,
              lastActiveDate: row.last_checkin_date,
            },
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(locSub);
      supabase.removeChannel(msgSub);
      supabase.removeChannel(pingSub);
      supabase.removeChannel(attSub);
    };
  }, [currentUser]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const timeStr = `${hours}:${minutes}`;
      setCurrentTimeStr(timeStr);

      const match = FITNESS_SCHEDULE.find((s) => s.time === timeStr);
      if (match && lastTriggeredAlarmRef.current !== timeStr) {
        lastTriggeredAlarmRef.current = timeStr;
        triggerAlarmVibration(`🚨 ${match.title}`, match.desc);
        playSquadAudio(match.audio as any);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const memberInfo = allMembers.find((m) => m.name.toLowerCase() === currentUser.toLowerCase());
    const photo = memberInfo ? memberInfo.photoUrl : `/members/${currentUser.toLowerCase()}.jpg`;

    if ("geolocation" in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          const updatedTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

          if (prevCoordsRef.current) {
            const dLat = (latitude - prevCoordsRef.current.lat) * 111.32;
            const dLon = (longitude - prevCoordsRef.current.lng) * 111.32 * Math.cos((latitude * Math.PI) / 180);
            const dist = Math.sqrt(dLat * dLat + dLon * dLon);
            if (dist > 0.005) {
              totalDistanceRef.current += dist;
            }
          }
          prevCoordsRef.current = { lat: latitude, lng: longitude };

          const distToGroundKm = Math.sqrt(
            Math.pow((latitude - PG_GROUND_COORDS.lat) * 111, 2) +
            Math.pow((longitude - PG_GROUND_COORDS.lng) * 111, 2)
          );

          if (distToGroundKm < 0.2 && !hasReachedGround) {
            setHasReachedGround(true);
            playSquadAudio("ground_reached");
            await supabase.from("squad_messages").insert([
              {
                sender: "Squad Radar",
                text: `📍 ${currentUser} PG Ground pahunch chuka hai!`,
                time: updatedTime,
                is_system: true,
              },
            ]);
          }

          await supabase.from("squad_locations").upsert(
            {
              name: currentUser,
              lat: latitude,
              lng: longitude,
              time: updatedTime,
              photo_url: photo,
              distance_km: parseFloat(totalDistanceRef.current.toFixed(2)),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "name" }
          );
        },
        (err) => console.warn("GPS error:", err),
        { 
          enableHighAccuracy: !groundBatteryMode, 
          maximumAge: groundBatteryMode ? 30000 : 2000, 
          timeout: 10000 
        }
      );
    }

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [currentUser, hasReachedGround, groundBatteryMode, allMembers]);

  useEffect(() => {
    async function loadFaceEngine() {
      try {
        const faceapi = await import("@vladmandic/face-api");
        faceApiRef.current = faceapi;
        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

        startWebcam();
        precomputeDescriptors(allMembers);
      } catch (err) {
        startWebcam();
      }
    }
    if (typeof window !== "undefined") loadFaceEngine();
  }, []);

  const startWebcam = () => {
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: 480, height: 480 } })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            let count = 3;
            setCameraCountdown(count);
            setStatus(`Camera Ready! Auto-scan in ${count}s...`);

            const interval = setInterval(() => {
              count -= 1;
              if (count > 0) {
                setCameraCountdown(count);
                setStatus(`Scanning in ${count}s...`);
              } else {
                clearInterval(interval);
                setCameraCountdown(null);
                handleScanFace();
              }
            }, 1000);
          };
        }
      })
      .catch(() => setStatus("Camera permission allow karein."));
  };

  const handleScanFace = async () => {
    const video = videoRef.current;
    const faceapi = faceApiRef.current;
    if (!video || video.readyState < 2 || !faceapi) {
      setStatus("Camera warm up ho raha hai...");
      return;
    }
    setIsScanning(true);
    setStatus("Instant verifying face...");

    try {
      if (labeledDescriptorsRef.current.length === 0) {
        await precomputeDescriptors(allMembers);
      }

      const liveDetection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!liveDetection) {
        setStatus("Chehra nahi dikha! Camera me sidha dekhein.");
        setIsScanning(false);
        return;
      }

      if (labeledDescriptorsRef.current.length > 0) {
        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptorsRef.current, 0.58);
        const bestMatch = faceMatcher.findBestMatch(liveDetection.descriptor);

        if (bestMatch.label !== "unknown") {
          const verifiedName = bestMatch.label;
          setCurrentUser(verifiedName);
          playSquadAudio("welcome");

          const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const todayDate = new Date().toDateString();

          const currentStreak = leaderboard[verifiedName]?.streak || 0;
          const isNewDay = leaderboard[verifiedName]?.lastActiveDate !== todayDate;
          const newStreak = isNewDay ? currentStreak + 1 : currentStreak;

          await supabase.from("squad_attendance").upsert(
            {
              name: verifiedName,
              last_checkin_time: timeNow,
              last_checkin_date: todayDate,
              streak: newStreak,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "name" }
          );

          await supabase.from("squad_messages").insert([
            {
              sender: "Security System",
              text: `🦅 Verified: ${verifiedName} attendance दर्ज हो गई (${timeNow}).`,
              time: timeNow,
              is_system: true,
            },
          ]);
        } else {
          setStatus("Access Denied: Chehra match nahi hua!");
          playSquadAudio("denied");
        }
      }
    } catch (err: any) {
      setStatus("Scan failed: " + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const startSosHold = () => {
    setSosHolding(true);
    sosTimerRef.current = setTimeout(() => {
      triggerSOS();
      setSosHolding(false);
    }, 2000);
  };

  const cancelSosHold = () => {
    setSosHolding(false);
    if (sosTimerRef.current) clearTimeout(sosTimerRef.current);
  };

  const triggerSOS = async () => {
    if (!currentUser) return;
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    triggerAlarmVibration(`🚨 SOS FROM ${currentUser}`, "Emergency alert!", true);
    playSquadAudio("sos");

    await supabase.from("squad_messages").insert([
      {
        sender: currentUser,
        text: `🚨 EMERGENCY SOS! ${currentUser} ne danger alert trigger kiya hai! Immediate backup required!`,
        time: timeNow,
        is_sos: true,
      },
    ]);
  };

  const sendWakeUpPing = async (targetUser: string) => {
    if (!currentUser) return;
    await supabase.from("squad_pings").insert([
      {
        target_user: targetUser,
        sent_by: currentUser,
      },
    ]);
    triggerAlarmVibration("Ping Sent!", `Wake-up ping sent to ${targetUser}`);
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const fileName = `voice_${Date.now()}.webm`;

        const { data: uploadData, error } = await supabase.storage
          .from("squad-media")
          .upload(`voice-notes/${fileName}`, audioBlob);

        if (!error && uploadData) {
          const { data: urlData } = supabase.storage
            .from("squad-media")
            .getPublicUrl(`voice-notes/${fileName}`);

          await supabase.from("squad_messages").insert([
            {
              sender: currentUser,
              text: "🎙️ Squad Walkie-Talkie Voice Note",
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              audio_url: urlData.publicUrl,
            },
          ]);
        }
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
    } catch (e) {
      console.warn("Audio mic error:", e);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecordingVoice) {
      mediaRecorderRef.current.stop();
      setIsRecordingVoice(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
    if (!apiKey) {
      alert("ImgBB API key not configured in .env.local!");
      return;
    }

    setIsUploadingImg(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        await supabase.from("squad_messages").insert([
          {
            sender: currentUser,
            text: "📷 Shared a photo",
            time: timeNow,
            image_url: data.data.url,
          },
        ]);
      } else {
        alert("Image upload failed: " + (data.error?.message || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading image to ImgBB.");
    } finally {
      setIsUploadingImg(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !currentUser) return;
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    await supabase.from("squad_messages").insert([
      {
        sender: currentUser,
        text: inputMsg.trim(),
        time: timeNow,
      },
    ]);
    setInputMsg("");
  };

  const currentMemberData = allMembers.find((m) => m.name.toLowerCase() === (currentUser || "").toLowerCase());
  const currentUserPhoto = currentMemberData?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser || "")}&background=18181b&color=f59e0b`;

  // SHOW APP STORE INSTALL PAGE IF NOT INSTALLED YET
  if (!isStandalone) {
    return (
      <AppStoreInstallModal
        onBypass={() => {
          sessionStorage.setItem("pwa_bypassed", "true");
          setIsStandalone(true);
        }}
      />
    );
  }

  if (!currentUser) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-950 text-white">
        <div className="w-full max-w-sm p-6 bg-zinc-900 border border-amber-500/40 rounded-3xl shadow-2xl flex flex-col items-center text-center">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-black uppercase tracking-wider text-amber-400">Golden eagle team</h1>
          </div>
          <div className="text-[11px] font-mono bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full border border-amber-500/30 mb-5">
            Check-in Window: 04:30 AM - 05:00 AM
          </div>

          <div className="relative w-52 h-52 rounded-full overflow-hidden border-2 border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.3)] bg-black mb-5 flex items-center justify-center">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
            {isScanning && <div className="absolute inset-0 bg-amber-500/20 animate-pulse border-2 border-amber-400 rounded-full" />}
            
            {cameraCountdown !== null && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
                <span className="text-6xl font-black text-amber-400 animate-ping font-mono">{cameraCountdown}</span>
                <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider mt-2">Auto-scanning...</span>
              </div>
            )}
          </div>

          <p className="text-xs text-amber-300 font-medium mb-5 min-h-[32px] flex items-center justify-center px-2">{status}</p>
          <button
            onClick={handleScanFace}
            disabled={isScanning}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm rounded-xl transition active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            {isScanning ? "Verifying..." : "Manual Scan Now"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white overflow-hidden relative">
      <header className="h-16 bg-zinc-900 border-b border-amber-500/20 px-3 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-2">
          <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-amber-500 bg-black flex-shrink-0 shadow-md">
            <img src={currentUserPhoto} alt={currentUser} className="w-full h-full object-cover" />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-black" />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-amber-400 font-extrabold flex items-center gap-1">
              🦅 Commander
            </span>
            <span className="text-sm font-black text-white leading-tight">
              {currentUser}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsRulesOpen(true)}
            className="p-1.5 px-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-xl text-[10px] font-bold flex items-center gap-1 active:scale-95"
            title="Squad Rules (Auto Voice)"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Rules
          </button>

          <button
            onClick={() => setIsAddMemberOpen(true)}
            className="p-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-xl text-[10px] font-bold flex items-center gap-1 active:scale-95"
            title="Register Member"
          >
            <UserPlus className="w-3.5 h-3.5" />
            + Member
          </button>

          <button
            onMouseDown={startSosHold}
            onMouseUp={cancelSosHold}
            onTouchStart={startSosHold}
            onTouchEnd={cancelSosHold}
            className={`px-2 py-1.5 rounded-xl border font-black text-[10px] flex items-center gap-1 transition active:scale-95 ${
              sosHolding ? "bg-red-600 text-white border-red-400 scale-105 animate-ping" : "bg-red-950/80 border-red-500/50 text-red-400 hover:bg-red-900"
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            {sosHolding ? "HOLD..." : "SOS"}
          </button>

          <button onClick={() => setCurrentUser(null)} className="p-1.5 text-zinc-500 hover:text-red-400">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* TOP NOTIFICATION BAR */}
      <div className="bg-zinc-900/95 border-b border-zinc-800 px-3 py-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Navigation className={`w-3.5 h-3.5 ${isLocationAllowed24x7 ? "text-emerald-400 animate-pulse" : "text-amber-400"}`} />
          <span className="text-[10px] text-zinc-300">
            24/7 Squad Radar: <b>{isLocationAllowed24x7 ? "Allowed" : "Pending"}</b>
          </span>
        </div>

        <button
          onClick={toggleLocation24x7}
          className={`px-3 py-1 rounded-lg text-[10px] font-black transition active:scale-95 flex items-center gap-1 shadow-sm ${
            isLocationAllowed24x7
              ? "bg-emerald-950/80 border border-emerald-500 text-emerald-400"
              : "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20"
          }`}
        >
          {isLocationAllowed24x7 ? "✓ Radar 24/7 Active" : "Allow 24/7 Location"}
        </button>
      </div>

      {/* TABS */}
      <div className="flex items-center justify-around bg-zinc-900/90 border-b border-zinc-800 py-1.5 px-2">
        <button onClick={() => setActiveTab("map")} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === "map" ? "bg-amber-500 text-black" : "text-zinc-400"}`}>
          <MapPin className="w-3.5 h-3.5" /> Map
        </button>
        <button onClick={() => setActiveTab("schedule")} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === "schedule" ? "bg-amber-500 text-black" : "text-zinc-400"}`}>
          <Dumbbell className="w-3.5 h-3.5" /> PG Routine
        </button>
        <button onClick={() => setActiveTab("leaderboard")} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === "leaderboard" ? "bg-amber-500 text-black" : "text-zinc-400"}`}>
          <Trophy className="w-3.5 h-3.5" /> Streaks
        </button>
        <button onClick={() => setActiveTab("chat")} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === "chat" ? "bg-amber-500 text-black" : "text-zinc-400"}`}>
          <MessageSquare className="w-3.5 h-3.5" /> Chat
        </button>
      </div>

      {activeTab === "map" && (
        <div className="flex-1 w-full h-full relative">
          <TeamMap currentUser={currentUser} membersLocations={locations} />
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-950 flex flex-col items-center">
          <div className="w-full max-w-md space-y-4">
            <div className="p-4 bg-gradient-to-r from-zinc-900 to-amber-950/30 border border-amber-500/40 rounded-2xl flex items-center justify-between shadow-lg">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Jogging Distance (To PG Ground)</span>
                <div className="text-2xl font-black text-white font-mono mt-0.5">
                  {totalDistanceRef.current.toFixed(2)} <span className="text-xs text-amber-400">KM</span>
                </div>
                <span className="text-[10px] text-zinc-400">
                  Status: {hasReachedGround ? "✅ Inside PG Ground" : "🏃 Running"}
                </span>
              </div>

              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95"
                >
                  Open Sets
                </button>
                <button
                  onClick={() => setGroundBatteryMode(!groundBatteryMode)}
                  className={`text-[9px] px-2 py-1 rounded-lg border font-bold flex items-center gap-1 ${
                    groundBatteryMode ? "bg-emerald-950 border-emerald-500 text-emerald-400" : "bg-zinc-800 border-zinc-700 text-zinc-400"
                  }`}
                >
                  <BatteryCharging className="w-3 h-3" />
                  {groundBatteryMode ? "Ground Mode ON" : "Battery Saver"}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {FITNESS_SCHEDULE.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => item.hasTimer && setIsModalOpen(true)}
                  className={`p-4 bg-zinc-900/80 border rounded-2xl flex items-start gap-3 transition ${
                    item.hasTimer ? "border-amber-500/50 hover:border-amber-400 cursor-pointer active:scale-98 shadow-md" : "border-zinc-800"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-lg flex-shrink-0">{item.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-white flex items-center gap-1">
                        {item.title} {item.hasTimer && <ChevronRight className="w-3.5 h-3.5 text-amber-400" />}
                      </h3>
                      <span className="text-xs font-mono font-extrabold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-500/30">{item.time} AM</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "leaderboard" && (
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-950 flex flex-col items-center">
          <div className="w-full max-w-md space-y-4">
            <div className="p-4 bg-gradient-to-r from-amber-500/20 to-zinc-900 border border-amber-500/40 rounded-2xl flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-amber-400 uppercase">Squad Fitness Streaks</h2>
                <p className="text-[11px] text-zinc-400">Database Realtime Verified</p>
              </div>
              <Award className="w-8 h-8 text-amber-400" />
            </div>

            <div className="space-y-2.5">
              {allMembers.map((member, index) => {
                const rec = leaderboard[member.name] || { name: member.name, time: "Not Checked In", streak: 0 };
                const isMe = member.name.toLowerCase() === currentUser.toLowerCase();

                return (
                  <div key={member.name} className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-center font-bold text-amber-400 text-sm">#{index + 1}</span>
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-amber-500/50 bg-black">
                        <img
                          src={member.photoUrl}
                          onError={(e: any) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=18181b&color=f59e0b`; }}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                          {member.name} 
                          {rec.streak > 0 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <div className="text-[10px] text-zinc-500">Scan: {rec.time}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {!isMe && rec.time === "Not Checked In" && (
                        <button
                          onClick={() => sendWakeUpPing(member.name)}
                          className="px-2.5 py-1.5 bg-red-950/80 border border-red-500/50 text-red-400 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-red-900 active:scale-95"
                          title="Send High-Pitch Wake Up Siren"
                        >
                          <Bell className="w-3 h-3" />
                          Ping
                        </button>
                      )}

                      <div className="text-right">
                        <div className="text-sm font-black text-amber-400 flex items-center gap-1 justify-end">
                          <Flame className="w-4 h-4 text-orange-500" /> {rec.streak} Days
                        </div>
                        <span className="text-[9px] uppercase tracking-wider text-emerald-400">
                          {rec.streak > 0 ? "Active" : "Pending"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CHAT TAB */}
      {activeTab === "chat" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[radial-gradient(#1c1917_1px,transparent_1px)] [background-size:16px_16px]">
            {messages.map((m, i) => {
              const isMe = m.sender === currentUser;

              if (m.is_sos) {
                return (
                  <div key={i} className="p-3 bg-red-950/80 border-2 border-red-500 rounded-2xl animate-pulse">
                    <div className="flex items-center gap-2 text-red-400 text-xs font-black uppercase"><AlertOctagon className="w-4 h-4" /> EMERGENCY SOS ALERT</div>
                    <p className="text-xs text-white mt-1 font-semibold">{m.text}</p>
                    <span className="text-[9px] text-zinc-400 mt-1 block">{m.time}</span>
                  </div>
                );
              }

              if (m.is_system) {
                return (
                  <div key={i} className="flex justify-center my-2">
                    <div className="text-[11px] bg-amber-950/40 border border-amber-500/30 text-amber-300 px-3.5 py-1.5 rounded-full flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>{m.text}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={i} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-zinc-500 mb-1 px-1">{m.sender}</span>
                  <div
                    className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${
                      isMe ? "bg-amber-500 text-black font-medium" : "bg-zinc-900 border border-zinc-800 text-white"
                    }`}
                  >
                    {m.text}
                    {m.audio_url && <audio controls src={m.audio_url} className="mt-2 h-7 w-48" />}
                    {m.image_url && (
                      <div className="mt-2 rounded-xl overflow-hidden border border-black/20 max-w-xs shadow-md">
                        <img src={m.image_url} alt="Shared photo" className="w-full h-auto object-cover" />
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-zinc-600 mt-1 px-1">{m.time}</span>
                </div>
              );
            })}
          </div>

          <form onSubmit={sendMessage} className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center gap-2">
            <button
              type="button"
              onMouseDown={startVoiceRecording}
              onMouseUp={stopVoiceRecording}
              onTouchStart={startVoiceRecording}
              onTouchEnd={stopVoiceRecording}
              className={`p-2.5 rounded-xl border transition active:scale-95 ${
                isRecordingVoice
                  ? "bg-red-600 border-red-400 text-white animate-pulse"
                  : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-amber-400"
              }`}
              title="Hold to Send Voice Note"
            >
              <Mic className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImg}
              className="p-2.5 bg-zinc-800 border border-zinc-700 hover:border-amber-500 text-zinc-300 hover:text-amber-400 rounded-xl transition active:scale-95 disabled:opacity-50"
              title="Send Photo via ImgBB"
            >
              {isUploadingImg ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <ImageIcon className="w-4 h-4" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />

            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder={isRecordingVoice ? "Recording..." : `Message squad as ${currentUser}...`}
              className="flex-1 px-3.5 py-2.5 bg-black border border-zinc-800 rounded-xl text-xs text-white outline-none focus:border-amber-500"
            />
            <button type="submit" className="p-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl transition">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Nearby Proximity Alert Banner */}
      {nearbyMember && (
        <div className="absolute bottom-16 left-3 right-3 z-[9999] bg-zinc-950/95 border-2 border-amber-500 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md flex items-center justify-between animate-in slide-in-from-bottom">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-amber-400 bg-black flex-shrink-0">
              <img
                src={nearbyMember.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(nearbyMember.name)}&background=18181b&color=f59e0b`}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-1 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                <span>Squad Member Nearby!</span>
              </div>
              <div className="text-xs font-black text-white">
                {nearbyMember.name} <span className="text-[10px] text-zinc-400 font-mono">({Math.round(nearbyMember.distanceMeters)}m)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => speakMemberName(nearbyMember.name, nearbyMember.distanceMeters)}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-[11px] font-black flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Naam Sunayein
            </button>
            <button onClick={() => setNearbyMember(null)} className="p-1 text-zinc-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {isModalOpen && <WorkoutTimerModal onClose={() => setIsModalOpen(false)} />}
      {isAddMemberOpen && (
        <AddMemberModal
          onClose={() => setIsAddMemberOpen(false)}
          onMemberAdded={loadSquadMembers}
        />
      )}
      {isRulesOpen && (
        <RulesModal onClose={() => setIsRulesOpen(false)} />
      )}
    </div>
  );
}
