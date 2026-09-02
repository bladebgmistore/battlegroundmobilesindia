"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { FaWhatsapp } from "react-icons/fa";
import { FiCheckCircle, FiClock, FiMail, FiSend, FiShield } from "react-icons/fi";
import { GridBackdrop, PageTitle, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { useStoreSettings } from "@/lib/use-store-settings";

type ContactForm = { name: string; whatsapp: string; message: string };

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

export default function ContactPage() {
  const [state, setState] = useState<"idle" | "success" | "error">("idle");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ContactForm>();
  const { whatsapp: whatsappUrl, whatsappNumber } = useStoreSettings();

  const submit = async (values: ContactForm) => {
    setState("idle");
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      if (!res.ok) throw new Error();
      setState("success");
      reset();
    } catch {
      setState("error");
    }
  };

  return (
    <>
      <GridBackdrop />
      <SiteHeader />
      <main>
        <PageTitle
          eyebrow="CONTACT SUPPORT"
          title="Here when the match matters."
          copy="Use the official WhatsApp channel for the quickest response, or leave the team a message and we will review it in the support inbox."
        />
        <section className="mx-auto grid max-w-6xl gap-5 px-5 pb-20 lg:grid-cols-[.75fr_1.25fr] lg:px-8">
          <aside className="space-y-4">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="premium-card block p-6 transition hover:border-[#0f4c81]">
              <FaWhatsapp className="text-3xl text-[#0e9f6e]" />
              <p className="mt-5 text-[10px] font-bold tracking-[.16em] text-[#0e9f6e]">FASTEST RESPONSE</p>
              <h2 className="mt-2 text-xl font-black text-[#0f172a]">Official WhatsApp Admin</h2>
              <p className="mt-2 text-sm text-[#64748b]">+91 {whatsappNumber}</p>
              <span className="mt-5 inline-flex text-[10px] font-bold tracking-[.12em] text-[#0e9f6e]">OPEN WHATSAPP →</span>
            </a>
            <div className="premium-card grid gap-3 p-6">
              {[[FiClock, "Support hours", "Every day · prompt online responses"], [FiShield, "Official channel", "Use the number shown on this website only"], [FiMail, "Message support", "Leave a request with your purchase question"]].map(([Icon, h, b]) => {
                const IconComp = Icon as typeof FiClock;
                return (
                  <div className="flex gap-3" key={h as string}>
                    <IconComp className="mt-0.5 shrink-0 text-[#0f4c81]" />
                    <div>
                      <p className="text-xs font-bold text-[#0f172a]">{h as string}</p>
                      <p className="mt-1 text-xs leading-5 text-[#64748b]">{b as string}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="premium-card p-6 sm:p-8">
            <p className="text-[10px] font-bold tracking-[.16em] text-[#0f4c81]">SEND A MESSAGE</p>
            <h2 className="mt-3 text-2xl font-black text-[#0f172a]">What can we help with?</h2>
            <form onSubmit={handleSubmit(submit)} className="mt-7 grid gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="YOUR NAME" error={errors.name?.message}>
                  <input {...register("name", { required: "Please enter your name" })} placeholder="Your name" className="form-input" />
                </Field>
                <Field label="WHATSAPP NUMBER" error={errors.whatsapp?.message}>
                  <input {...register("whatsapp", { required: "Please enter your WhatsApp number", minLength: { value: 10, message: "Enter a valid number" } })} placeholder="10-digit number" inputMode="numeric" className="form-input" />
                </Field>
              </div>
              <Field label="YOUR MESSAGE" error={errors.message?.message}>
                <textarea {...register("message", { required: "Tell us how we can help", minLength: { value: 10, message: "Please add a little more detail" } })} placeholder="Tell us about the account, UC pack or support you need..." rows={6} className="form-input resize-none py-3" />
              </Field>
              {state === "success" && <div className="flex items-center gap-2 rounded-lg bg-[#e6f8ef] p-3 text-xs font-bold text-[#0e9f6e]"><FiCheckCircle /> Message sent to the support inbox.</div>}
              {state === "error" && <div className="rounded-lg bg-red-50 p-3 text-xs font-bold text-red-600">We couldn&apos;t send this message. Please use WhatsApp instead.</div>}
              <button disabled={isSubmitting} className="btn-primary w-fit"><FiSend />{isSubmitting ? "SENDING..." : "SEND SUPPORT MESSAGE"}</button>
            </form>
          </section>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Field({ label, error, children }: FieldProps) {
  return (
    <label className="grid gap-2 text-[10px] font-bold tracking-[.12em] text-[#334155]">
      {label}
      {children}
      {error && <span className="normal-case tracking-normal text-red-600">{error}</span>}
    </label>
  );
}
