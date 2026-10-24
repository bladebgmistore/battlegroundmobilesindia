"use client";

import { useId, useState, type ChangeEvent } from "react";
import { FiChevronDown } from "react-icons/fi";
import {
  COUNTRY_DIAL_CODES,
  DEFAULT_DIAL_CODE,
  isCompleteLocalNumber,
  splitWhatsapp,
} from "@/lib/phone";

/**
 * Country-code aware WhatsApp number input.
 *
 * The value is a controlled E.164 string (`+919876543210`) or `""` when empty.
 * The displayed dial code + local digits are derived from that string, so the
 * field can never drift out of sync with the profile stored on the server.
 */
export function WhatsappInput({
  value,
  onChange,
  disabled,
  autoFocus,
  id,
  placeholder = "WhatsApp number",
  invalid,
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  // Only needed while the field is empty (choosing a country before typing).
  const [emptyDial, setEmptyDial] = useState<string>(DEFAULT_DIAL_CODE);

  const parsed = splitWhatsapp(value);
  const dial = value ? parsed.dial : emptyDial;
  const local = value ? parsed.local : "";

  const emit = (nextDial: string, nextLocal: string) => {
    // Remember the chosen country so clearing the field keeps it selected.
    setEmptyDial(nextDial);
    const digits = nextLocal.replace(/\D/g, "");
    onChange(digits ? `+${nextDial.replace(/\D/g, "")}${digits}` : "");
  };

  const handleDial = (event: ChangeEvent<HTMLSelectElement>) => {
    setEmptyDial(event.target.value);
    emit(event.target.value, local);
  };

  const handleLocal = (event: ChangeEvent<HTMLInputElement>) => {
    // E.164 caps the whole number at 15 digits, country code included, and
    // Indian mobiles are always exactly 10 — stop accepting extra keystrokes
    // instead of silently storing an undialable number.
    const e164Room = Math.max(1, 15 - dial.replace(/\D/g, "").length);
    const room = dial === "+91" ? Math.min(10, e164Room) : Math.min(14, e164Room);
    emit(dial, event.target.value.replace(/\D/g, "").slice(0, room));
  };

  const country = COUNTRY_DIAL_CODES.find((item) => item.dial === dial) ?? COUNTRY_DIAL_CODES[0];

  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-xl border bg-white transition focus-within:border-[#0f4c81] ${
        invalid ? "border-red-300" : "border-[#dbe2ec]"
      } ${disabled ? "opacity-60" : ""} ${className}`}
    >
      <div className="relative flex shrink-0 items-center border-r border-[#e5e8ef] bg-[#f8fafc]">
        <span aria-hidden="true" className="pl-3 text-base leading-none">{country.flag}</span>
        <select
          aria-label="Country calling code"
          value={dial}
          onChange={handleDial}
          disabled={disabled}
          className="appearance-none bg-transparent py-3 pl-2 pr-7 text-xs font-black text-[#0f172a] outline-none"
        >
          {COUNTRY_DIAL_CODES.map((item) => (
            <option key={`${item.iso}-${item.dial}`} value={item.dial}>
              {item.iso} {item.dial}
            </option>
          ))}
        </select>
        <FiChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 text-xs text-[#94a3b8]" />
      </div>
      {/* text-base (16px) on phones stops iOS Safari from zooming the page on
          focus, which made the field feel frozen while typing. */}
      <input
        id={inputId}
        value={local}
        onChange={handleLocal}
        disabled={disabled}
        autoFocus={autoFocus}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="tel-national"
        enterKeyHint="done"
        spellCheck={false}
        placeholder={placeholder}
        aria-invalid={invalid ? true : undefined}
        className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base font-semibold text-[#0f172a] outline-none placeholder:font-medium placeholder:text-[#97a3b6] sm:text-sm"
      />
    </div>
  );
}

/** True when the controlled value is a plausible complete number. */
export function isCompleteWhatsapp(value: string): boolean {
  const { dial, local } = splitWhatsapp(value);
  return isCompleteLocalNumber(dial, local);
}
