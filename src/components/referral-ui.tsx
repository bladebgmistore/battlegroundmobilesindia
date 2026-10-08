import { FiCheckCircle, FiClock, FiXCircle } from "react-icons/fi";

/** Points with thousands separators and an explicit sign, e.g. "+1,250" / "−2,000". */
export function formatSignedPoints(points: number): string {
  if (points === 0) return "0";
  const absolute = Math.abs(points).toLocaleString("en-IN");
  return points > 0 ? `+${absolute}` : `−${absolute}`;
}

export function formatPoints(points: number): string {
  return points.toLocaleString("en-IN");
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

const STATUS_STYLE: Record<string, { label: string; className: string; icon: typeof FiClock }> = {
  credited: { label: "CREDITED", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: FiCheckCircle },
  reversed: { label: "REVERSED", className: "bg-red-50 text-red-600 border-red-200", icon: FiXCircle },
  pending: { label: "PENDING", className: "bg-amber-50 text-amber-700 border-amber-200", icon: FiClock },
  completed: { label: "COMPLETED", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: FiCheckCircle },
  rejected: { label: "REFUNDED", className: "bg-red-50 text-red-600 border-red-200", icon: FiXCircle },
};

/** Coloured status pill used by the dashboard, the points store and the admin panel. */
export function StatusChip({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? { label: status.toUpperCase(), className: "bg-[#f1f5fb] text-[#64748b] border-[#dbe2ec]", icon: FiClock };
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-black tracking-[.12em] ${style.className}`}>
      <Icon className="text-xs" /> {style.label}
    </span>
  );
}
