"use client";

import { useEffect } from 'react';
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 text-center bg-[#eef1f6]">
      <div className="relative">
        <div className="text-5xl text-[#d8f454] mb-4">⚠</div>
        <p className="text-[11px] font-black tracking-[.2em] text-[#d8f454]">SYSTEM ERROR</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-.08em] text-[#0f172a]">Something went wrong</h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-[#64748b]">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <div className="mt-7 flex gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#cbed3e] px-5 py-3 text-xs font-black tracking-[.1em] text-[#101408]"
          >
            Try Again
          </button>
          <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-[#3a3a3a] px-5 py-3 text-xs font-black tracking-[.1em] text-[#0f172a]">
            <FiArrowLeft /> RETURN HOME
          </Link>
        </div>
      </div>
    </main>
  );
}