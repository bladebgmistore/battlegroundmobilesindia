"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { FaStar, FaWhatsapp } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { FiCheckCircle, FiEdit3, FiLoader, FiX } from "react-icons/fi";

type Feedback = {
  id?: string;
  name: string;
  review?: string;
  body?: string;
  rating?: number;
  avatar?: string | null;
  createdAt?: string;
};

type SessionState = {
  authenticated: boolean;
  user?: { name?: string; email?: string; picture?: string | null };
};

/** Staggered reveal for the review cards. */
const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 26, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 220, damping: 24 },
  },
};

function Stars({ rating, size = "text-xs" }: { rating: number; size?: string }) {
  return (
    <div className={`flex gap-1 text-[#f4b400] ${size}`}>
      {Array.from({ length: Math.max(1, Math.min(5, rating || 5)) }).map((_, index) => (
        <FaStar key={index} />
      ))}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function FeedbackSection({ whatsappUrl }: { whatsappUrl: string }) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [session, setSession] = useState<SessionState>({ authenticated: false });
  const [formOpen, setFormOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState("");
  const [reviewOffset, setReviewOffset] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;

    fetch(`/api/feedbacks?t=${Date.now()}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (alive && data?.feedbacks) setFeedbacks(data.feedbacks as Feedback[]);
      })
      .catch(() => undefined);

    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (alive && data) setSession(data as SessionState);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  const visible: Feedback[] = feedbacks;

  useEffect(() => {
    if (visible.length <= 3) return undefined;
    const interval = window.setInterval(() => {
      setReviewOffset((current) => (current + 1) % visible.length);
    }, 3600);
    return () => window.clearInterval(interval);
  }, [visible.length]);

  const movingFeedbacks = useMemo(() => {
    const limit = Math.min(3, visible.length);
    return Array.from({ length: limit }, (_, index) => visible[(reviewOffset + index) % visible.length]);
  }, [reviewOffset, visible]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    setError("");

    const text = review.trim();
    if (text.length < 10) {
      setError("Please write at least 10 characters.");
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: session.user?.name, review: text, rating }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error ?? "Could not submit your review.");
        return;
      }
      setDone(true);
      setReview("");
      setRating(5);
      setFormOpen(false);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
        <div data-aos="fade-right" data-aos-delay="80">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[11px] font-bold tracking-[.22em] text-[#0f4c81]"
          >
            PLAYER FEEDBACK
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="mt-3 text-4xl font-black tracking-[-.05em] text-[#0f172a]"
          >
            Earned in the
            <br />
            community.
          </motion.h2>
          <p className="mt-5 max-w-sm text-sm leading-7 text-[#64748b]">
            Trusted by thousands of community members for a straightforward buying journey and responsive
            communication. Bought from us? Share your experience — every review is checked by our team before it
            goes live.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {session.authenticated ? (
              <button
                type="button"
                onClick={() => {
                  setFormOpen((open) => !open);
                  setDone(false);
                }}
                className="btn-primary group w-fit"
              >
                {formOpen ? "CLOSE" : "WRITE A REVIEW"} {formOpen ? <FiX /> : <FiEdit3 />}
              </button>
            ) : (
              <a href="/auth/google?next=/%23feedback" className="btn-outline w-fit">
                <FcGoogle className="text-base" /> SIGN IN TO REVIEW
              </a>
            )}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-bold tracking-[.1em] text-[#0f4c81]"
            >
              <FaWhatsapp className="text-base" /> SPEAK WITH SUPPORT
            </a>
          </div>

          {/* Success banner */}
          <AnimatePresence>
            {done && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <p className="flex items-start gap-2 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-xs font-semibold leading-5 text-[#166534]">
                  <FiCheckCircle className="mt-0.5 shrink-0 text-sm" />
                  Thanks! Your review has been sent for approval. It will appear here once our team accepts it.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Review form */}
          <AnimatePresence initial={false}>
            {formOpen && session.authenticated && (
              <motion.form
                id="feedback"
                onSubmit={submit}
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -8 }}
                transition={{ duration: 0.28 }}
                className="mt-5 overflow-hidden"
              >
                <div className="premium-card grid gap-4 p-5">
                  <div className="flex items-center gap-3">
                    {session.user?.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={session.user.picture} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#e0eefb] text-[11px] font-black text-[#0f4c81]">
                        {initials(session.user?.name ?? "You")}
                      </span>
                    )}
                    <div>
                      <p className="text-xs font-bold text-[#0f172a]">{session.user?.name ?? "You"}</p>
                      <p className="text-[10px] font-semibold text-[#64748b]">{session.user?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-[.12em] text-[#64748b]">YOUR RATING</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onMouseEnter={() => setHoverRating(value)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(value)}
                          aria-label={`${value} star`}
                          className="text-base transition-transform hover:scale-125"
                        >
                          <FaStar className={(hoverRating || rating) >= value ? "text-[#f4b400]" : "text-[#cbd5e1]"} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    value={review}
                    onChange={(event) => setReview(event.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder="How was your buying experience? (min 10 characters)"
                    className="w-full rounded-lg border border-[#dbe2ec] bg-white p-3 text-sm text-[#0f172a] outline-none focus:border-[#0f4c81]"
                  />

                  {error && <p className="text-[11px] font-bold text-red-600">{error}</p>}

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold text-[#94a3b8]">{review.trim().length}/1000</span>
                    <button type="submit" disabled={sending} className="btn-primary w-fit disabled:opacity-60">
                      {sending ? <FiLoader className="animate-spin" /> : <FiCheckCircle />}
                      {sending ? "SENDING" : "SUBMIT REVIEW"}
                    </button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Moving review carousel: 1-2-3, then 2-3-4, and so on. */}
        <motion.div
          variants={listVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          data-aos="fade-left"
          className="grid gap-4 md:grid-cols-3"
        >
          {movingFeedbacks.length === 0 ? (
            <div className="premium-card md:col-span-3 p-8 text-center" data-aos="fade-up">
              <p className="text-sm font-black text-[#0f172a]">No approved feedback is live yet.</p>
              <p className="mt-2 text-xs text-[#64748b]">Approved database reviews will move here automatically.</p>
            </div>
          ) : null}
          <AnimatePresence initial={false} mode="popLayout">
            {movingFeedbacks.map((item, index) => (
              <motion.article
                key={item.id || item.name || index}
                layout
                variants={cardVariants}
                initial={{ opacity: 0, x: 46, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -46, y: -8, scale: 0.94 }}
                transition={{ type: "spring", stiffness: 230, damping: 26, delay: index * 0.04 }}
                whileHover={{ y: -10, scale: 1.02, boxShadow: "0 20px 46px rgba(56,189,248,.22)" }}
                whileTap={{ y: -12, scale: 1.025 }}
                className="premium-card gaming-card p-5"
              >
                <Stars rating={item.rating ?? 5} />
                <p className="mt-4 text-sm leading-6 text-[#334155]">“{item.review || item.body}”</p>
                <div className="mt-6 flex items-center gap-3 border-t border-[#e5e8ef] pt-4">
                  {item.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e0eefb] text-[10px] font-black text-[#0f4c81]">
                      {initials(item.name)}
                    </span>
                  )}
                  <div>
                    <p className="text-xs font-bold text-[#0f172a]">{item.name}</p>
                    <p className="mt-1 text-[9px] font-bold tracking-[.12em] text-[#0e9f6e]">VERIFIED BUYER</p>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
