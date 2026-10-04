"use client";

import { useState } from "react";
import { FiImage, FiUpload } from "react-icons/fi";
import { convertGoogleDriveUrl } from "@/lib/image-utils";
import { compressImageFile } from "@/lib/client-image";

export function ImageInput({
  value,
  onChange,
  label = "IMAGE",
  placeholder = "Paste image URL or upload from gallery",
  /** Keep PNG transparency (logos, favicons) instead of flattening to JPEG. */
  transparent = false,
  /** Longest edge in px after resizing. Favicons only need 256. */
  maxDimension = 1280,
  /** Square preview — handy for logo/favicon fields. */
  square = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  transparent?: boolean;
  maxDimension?: number;
  square?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      // Compress in-browser so stored Base64 stays small (no payload errors).
      const compressed = await compressImageFile(file, {
        targetBytes: transparent ? 180 * 1024 : 400 * 1024,
        maxDimension,
        ...(transparent ? { preserveTransparency: true } : {}),
      });
      onChange(compressed.dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that image.");
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
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/*" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
        </label>
      </div>
      {error && <span className="text-[10px] font-bold normal-case tracking-normal text-red-600">{error}</span>}
      {value && (
        <div className="mt-1 flex items-center gap-3 rounded-lg border border-[#e5e8ef] bg-[#f8fafc] p-2">
          {/* Checkerboard so transparent PNGs are obvious */}
          <span
            className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md border border-[#e5e8ef] ${square ? "bg-white" : ""}`}
            style={{
              backgroundImage:
                "linear-gradient(45deg,#e9eef5 25%,transparent 25%),linear-gradient(-45deg,#e9eef5 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e9eef5 75%),linear-gradient(-45deg,transparent 75%,#e9eef5 75%)",
              backgroundSize: "10px 10px",
              backgroundPosition: "0 0,0 5px,5px -5px,-5px 0",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Preview" className={`h-14 w-14 ${square ? "object-contain p-1" : "object-cover"}`} />
          </span>
          <span className="flex items-center gap-1 text-[10px] font-medium normal-case tracking-normal text-[#64748b]">
            <FiImage /> {transparent ? "PNG transparency preserved" : "Image preview"}
          </span>
        </div>
      )}
    </label>
  );
}
