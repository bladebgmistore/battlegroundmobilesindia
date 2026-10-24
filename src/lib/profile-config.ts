/**
 * Client + server shared constants for the post-signup profile prompt.
 *
 * Kept in its own dependency-free module so the browser bundle never has to
 * pull in `auth-config` (which reads environment variables).
 */

/** One-shot cookie set by the OAuth callback for a brand-new account. */
export const SIGNUP_COOKIE = "bgmi_new_account";

/** 30 minutes — long enough for the first page render after the redirect. */
export const SIGNUP_COOKIE_MAX_AGE_SECONDS = 60 * 30;

/** localStorage key remembering that the buyer dismissed the prompt. */
export const WHATSAPP_PROMPT_DISMISS_KEY = "bgmi_whatsapp_prompt_dismissed_at";

/** Re-show the prompt at most once a week when no number is saved. */
export const WHATSAPP_PROMPT_REMIND_MS = 1000 * 60 * 60 * 24 * 7;
