"use client";

import { useEffect } from 'react';
import Link from "next/link";
import { FiAlertTriangle, FiArrowLeft } from "react-icons/fi";
import { GridBackdrop } from "@/components/site-chrome";

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
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 text-center">
      <GridBackdrop />
      <div className="relative">
        <FiAlertTriangle className="mx-auto text-5xl text-[#0f4c81]" />
        <p className="mt-6 text-[11px] font-black tracking-[.2em] text-[#0f4c81]">SYSTEM ERROR</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-.08em] text-[#0f172a]">Something went wrong</h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-[#64748b]">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <div className="mt-7 flex gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="btn-primary"
          >
            Try Again
          </button>
          <Link href="/" className="btn-outline">
            <FiArrowLeft /> RETURN HOME
          </Link>
        </div>
      </div>
    </main>
  );
}
