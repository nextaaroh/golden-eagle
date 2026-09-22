"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Camera, Upload, UserPlus, CheckCircle2, Loader2 } from "lucide-react";

export default function AddMemberModal({
  onClose,
  onMemberAdded,
}: {
  onClose: () => void;
  onMemberAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveMember = async () => {
    if (!name.trim()) {
      setErrorMsg("Kripya member ka naam likhein!");
      return;
    }
    if (!photoBase64) {
      setErrorMsg("Face photo upload ya click karein!");
      return;
    }

    setUploading(true);
    setErrorMsg("");

    try {
      // 1. Upload photo to Supabase Storage or save directly
      const cleanName = name.trim();
      const fileName = `${cleanName.toLowerCase()}_${Date.now()}.jpg`;

      // Convert base64 to blob
      const res = await fetch(photoBase64);
      const blob = await res.blob();

      const { data: storageData, error: storageErr } = await supabase.storage
        .from("squad-media")
        .upload(`members/${fileName}`, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      let publicUrl = photoBase64; // Fallback

      if (!storageErr && storageData) {
        const { data: urlData } = supabase.storage
          .from("squad-media")
          .getPublicUrl(`members/${fileName}`);
        publicUrl = urlData.publicUrl;
      }

      // 2. Insert into squad_registered_members table
      const { error: dbErr } = await supabase
        .from("squad_registered_members")
        .upsert(
          {
            name: cleanName,
            photo_url: publicUrl,
          },
          { onConflict: "name" }
        );

      if (dbErr) throw dbErr;

      // 3. Initialize attendance entry
      await supabase.from("squad_attendance").upsert(
        {
          name: cleanName,
          last_checkin_time: "Not Checked In",
          streak: 0,
        },
        { onConflict: "name" }
      );

      onMemberAdded();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Upload failed: " + (err.message || "Error"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-sm bg-zinc-950 border border-amber-500/50 rounded-3xl p-5 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-black uppercase tracking-wider text-amber-400">
              Add Squad Member
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg bg-zinc-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-zinc-400 my-3">
          Naye dost ka naam aur clear face photo upload karein taaki biometric entry aur radar me jud sake:
        </p>

        {/* Photo Preview / Click Box */}
        <div className="flex flex-col items-center justify-center my-2">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-28 h-28 rounded-full border-2 border-dashed border-amber-500/60 bg-zinc-900 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group hover:border-amber-400 transition"
          >
            {photoBase64 ? (
              <img src={photoBase64} className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center text-zinc-400">
                <Camera className="w-6 h-6 mb-1 text-amber-400" />
                <span className="text-[10px] font-bold">Upload Photo</span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Name Input */}
        <div className="space-y-1 my-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Member Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rahul, Rohit"
            className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white outline-none focus:border-amber-500 font-semibold"
          />
        </div>

        {errorMsg && (
          <p className="text-xs text-red-400 text-center mb-2 font-medium">{errorMsg}</p>
        )}

        <button
          onClick={handleSaveMember}
          disabled={uploading}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl transition active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 mt-1"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving to Squad Database...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Register Member
            </>
          )}
        </button>
      </div>
    </div>
  );
}
