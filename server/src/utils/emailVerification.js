import crypto from "crypto";

export const CODE_TTL_MS = 15 * 60 * 1000;
export const RESEND_WAIT_MS = 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;

// A new sign-up is unverified until it enters its code. Accounts made before
// email codes existed have no value and count as verified.
export function isEmailVerified(user) {
  return user?.emailVerified !== false;
}

function hashCode(userId, code) {
  return crypto.createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

// Puts a fresh 6-digit code on the user (not saved) and returns the plain code.
export function issueVerificationCode(user) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  user.emailVerification = {
    codeHash: hashCode(user._id.toString(), code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
    attempts: 0,
    sentAt: new Date(),
  };
  return code;
}

export function canResendCode(user) {
  const sentAt = user?.emailVerification?.sentAt;
  return !sentAt || Date.now() - new Date(sentAt).getTime() >= RESEND_WAIT_MS;
}

// Checks a code and counts the try. Returns "ok", "expired", "too_many" or "wrong".
export function checkVerificationCode(user, code) {
  const v = user.emailVerification || {};
  if (!v.codeHash || !v.expiresAt || new Date(v.expiresAt).getTime() < Date.now()) {
    return "expired";
  }
  if ((v.attempts || 0) >= MAX_CODE_ATTEMPTS) return "too_many";

  user.emailVerification.attempts = (v.attempts || 0) + 1;

  const given = hashCode(user._id.toString(), String(code || "").trim());
  const ok =
    given.length === v.codeHash.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(v.codeHash));
  return ok ? "ok" : "wrong";
}

export function markEmailVerified(user) {
  user.emailVerified = true;
  user.emailVerification = { codeHash: "", expiresAt: null, attempts: 0, sentAt: null };
}
