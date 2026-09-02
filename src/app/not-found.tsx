import Link from "next/link";
import { FiArrowLeft, FiCrosshair } from "react-icons/fi";
import { GridBackdrop } from "@/components/site-chrome";

export const metadata = {
  title: "404: Page Not Found | Battleground India Store",
};

export default function NotFound() { return <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 text-center"><GridBackdrop /><div className="relative"><FiCrosshair className="mx-auto text-5xl text-[#d8f454]"/><p className="mt-6 text-[11px] font-black tracking-[.2em] text-[#d8f454]">OUT OF BOUNDS</p><h1 className="mt-3 text-6xl font-black tracking-[-.08em] text-[#0f172a]">404</h1><p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-[#64748b]">This drop zone does not exist. Return to the store and find your next upgrade.</p><Link href="/" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#cbed3e] px-5 py-3 text-xs font-black tracking-[.1em] text-[#101408]"><FiArrowLeft/> RETURN HOME</Link></div></main>; }
