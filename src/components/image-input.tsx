"use client";

import { useState } from "react";
import { FiImage, FiUpload } from "react-icons/fi";
import { convertGoogleDriveUrl } from "@/lib/image-utils";
import { compressImageFile } from "@/lib/client-image";

export function ImageInput({ value, onChange, label = "IMAGE", placeholder = "Paste image URL or upload from gallery" }: { value: string; onChange: (value: string) => void; label?: string; placeholder?: string }) {
  const [busy, setBusy] = useState(false);

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      // Compress in-browser so stored Base64 stays small (no payload errors).
      const compressed = await compressImageFile(file, { targetBytes: 400 * 1024, maxDimension: 1280 });
      onChange(compressed.dataUrl);
    } catch {
      // Fall back silently — the admin can paste a URL instead.
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className="grid gap-2 text-[10px] font-bold tracking-wide text-[#334155]">
      {label}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          value={value}
          onChange={(e) => onChange(convertGoogleDriveUrl(e.target.value))}
          placeholder={placeholder}
          className="admin-input"
        />
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#dbe2ec] bg-white px-4 py-3 text-[10px] font-black text-[#0f4c81] hover:bg-[#f1f5fb]">
          <FiUpload /> {busy ? "UPLOADING" : "UPLOAD"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
        </label>
      </div>
      {value && (
        <div className="mt-1 flex items-center gap-3 rounded-lg border border-[#e5e8ef] bg-[#f8fafc] p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Preview" className="h-14 w-14 rounded-md object-cover" />
          <span className="flex items-center gap-1 text-[10px] font-medium normal-case tracking-normal text-[#64748b]"><FiImage /> Image preview</span>
        </div>
      )}
    </label>
  );
}
