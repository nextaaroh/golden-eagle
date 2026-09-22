"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Menu, X, Navigation, Compass, Route } from "lucide-react";
import { TEAM_MEMBERS } from "@/lib/members";
import { playSquadAudio } from "@/lib/voiceService";

interface UserLocation {
  name: string;
  lat: number;
  lng: number;
  time: string;
  photoUrl?: string;
}

export default function TeamMap({
  currentUser,
  membersLocations,
}: {
  currentUser: string;
  membersLocations: Record<string, UserLocation>;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const routeLineRef = useRef<L.Polyline | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeRouteTarget, setActiveRouteTarget] = useState<string | null>(null);
  const [routeDistance, setRouteDistance] = useState<string | null>(null);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(2)} km`;
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        maxZoom: 22,
      }).setView([23.12, 83.19], 15);

      L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
        maxZoom: 22,
        maxNativeZoom: 20,
        attribution: "Google Satellite",
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    Object.values(membersLocations).forEach((member) => {
      const isMe = member.name.toLowerCase() === currentUser.toLowerCase();
      const avatar = member.photoUrl || `/members/${member.name.toLowerCase()}.jpg`;

      const customIcon = L.divIcon({
        className: "custom-avatar-pin",
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
            <span style="background:rgba(0,0,0,0.9); color:${isMe ? "#f59e0b" : "#38bdf8"}; font-size:11px; font-weight:bold; padding:2px 8px; border-radius:999px; border:1px solid ${isMe ? "#f59e0b" : "#38bdf8"}; white-space:nowrap; box-shadow:0 3px 6px rgba(0,0,0,0.7);">
              ${isMe ? "Aap (You)" : member.name}
            </span>
            <div style="width:38px; height:38px; border-radius:50%; border:2.5px solid ${isMe ? "#f59e0b" : "#38bdf8"}; overflow:hidden; background:#000; box-shadow:0 0 10px rgba(0,0,0,0.8); margin-top:3px;">
              <img src="${avatar}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=18181b&color=f59e0b'" style="width:100%; height:100%; object-fit:cover;" />
            </div>
            <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:7px solid ${isMe ? "#f59e0b" : "#38bdf8"};"></div>
          </div>
        `,
        iconSize: [0, 0],
      });

      if (markersRef.current[member.name]) {
        markersRef.current[member.name].setLatLng([member.lat, member.lng]);
        markersRef.current[member.name].setIcon(customIcon);
      } else {
        const marker = L.marker([member.lat, member.lng], { icon: customIcon }).addTo(map);
        markersRef.current[member.name] = marker;
      }
    });

    if (activeRouteTarget && membersLocations[activeRouteTarget] && membersLocations[currentUser]) {
      drawInAppDirection(membersLocations[activeRouteTarget], false);
    }
  }, [membersLocations, currentUser]);

  const drawInAppDirection = (targetMember: UserLocation, playAudio = true) => {
    const myPos = membersLocations[currentUser];
    if (!myPos || !mapInstanceRef.current) return;

    if (routeLineRef.current) {
      routeLineRef.current.remove();
    }

    const dist = calculateDistance(myPos.lat, myPos.lng, targetMember.lat, targetMember.lng);
    setRouteDistance(dist);
    setActiveRouteTarget(targetMember.name);

    if (playAudio) {
      playSquadAudio("navigation", "Target lock kar liya gaya hai. Squad navigation route map par set ho chuka hai.");
    }

    const route = L.polyline(
      [
        [myPos.lat, myPos.lng],
        [targetMember.lat, targetMember.lng],
      ],
      {
        color: "#f59e0b",
        weight: 5,
        opacity: 0.9,
        dashArray: "8, 10",
      }
    ).addTo(mapInstanceRef.current);

    routeLineRef.current = route;
    mapInstanceRef.current.fitBounds(route.getBounds(), { padding: [60, 60] });
    setMenuOpen(false);
  };

  const clearRoute = () => {
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }
    setActiveRouteTarget(null);
    setRouteDistance(null);
  };

  const focusMember = (loc?: UserLocation) => {
    if (!loc || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([loc.lat, loc.lng], 18, { duration: 1.2 });
    setMenuOpen(false);
  };

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      <div className="absolute top-4 left-4 z-[9999] flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-black/90 border border-amber-500/70 text-amber-400 rounded-xl shadow-2xl backdrop-blur active:scale-95 transition"
        >
          <Menu className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-bold uppercase tracking-wider">Members</span>
        </button>

        {activeRouteTarget && (
          <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/95 border border-amber-500/80 rounded-xl text-xs text-white shadow-xl">
            <Route className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>
              To <b className="text-amber-400">{activeRouteTarget}</b>: <b>{routeDistance}</b>
            </span>
            <button
              onClick={clearRoute}
              className="ml-1 text-zinc-400 hover:text-red-400 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-[10000] flex">
          <div
            className="flex-1 bg-black/60 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div className="w-80 bg-zinc-950 border-l border-zinc-800 h-full p-4 flex flex-col shadow-2xl animate-in slide-in-from-right">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-amber-400" />
                <h2 className="text-sm font-bold tracking-wider uppercase text-amber-400">
                  Squad Radar (24/7)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-zinc-500 my-3">
              Direction button dabane par squad navigation route banega:
            </p>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {TEAM_MEMBERS.map((m) => {
                const liveData = membersLocations[m.name];
                const isOnline = !!liveData;
                const isMe = m.name.toLowerCase() === currentUser.toLowerCase();

                return (
                  <div
                    key={m.name}
                    onClick={() => liveData && focusMember(liveData)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                      isMe
                        ? "bg-amber-950/30 border-amber-500/50"
                        : "bg-zinc-900/90 border-zinc-800"
                    } ${isOnline ? "cursor-pointer hover:border-zinc-700" : "opacity-60"}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border border-amber-500/50 bg-black flex-shrink-0">
                        <img
                          src={m.photoUrl}
                          onError={(e: any) => {
                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=18181b&color=f59e0b`;
                          }}
                          className="w-full h-full object-cover"
                        />
                        <span
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-black ${
                            isOnline ? "bg-emerald-500" : "bg-zinc-600"
                          }`}
                        />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">
                          {m.name} {isMe && <span className="text-[10px] text-amber-400">(You)</span>}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {isOnline ? `Active • ${liveData.time}` : "Offline"}
                        </div>
                      </div>
                    </div>

                    {!isMe && isOnline && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          drawInAppDirection(liveData, true);
                        }}
                        className="p-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl transition active:scale-95 shadow-md shadow-amber-500/20"
                        title="Draw Route on Map"
                      >
                        <Navigation className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
