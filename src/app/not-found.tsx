import Link from "next/link";
import { FiArrowLeft, FiCrosshair } from "react-icons/fi";
import { GridBackdrop } from "@/components/site-chrome";

export const metadata = {
  title: "404: Page Not Found | Battleground India Store",
};

export default function NotFound() { return <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 text-center"><GridBackdrop /><div className="relative"><FiCrosshair className="mx-auto text-5xl text-[#0f4c81]"/><p className="mt-6 text-[11px] font-black tracking-[.2em] text-[#0f4c81]">OUT OF BOUNDS</p><h1 className="mt-3 text-6xl font-black tracking-[-.08em] text-[#0f172a]">404</h1><p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-[#64748b]">This page does not exist. Return to the store and find your next upgrade.</p><Link href="/" className="btn-primary mt-7 inline-flex items-center gap-2"><FiArrowLeft/> RETURN HOME</Link></div></main>; }
