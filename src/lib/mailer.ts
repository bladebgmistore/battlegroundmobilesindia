import nodemailer from "nodemailer";

/**
 * Sends the admin password-reset OTP by email.
 * Works when SMTP env vars are configured:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, OTP_FROM
 * Common free setup (Gmail): SMTP_HOST=smtp.gmail.com, SMTP_PORT=465,
 * SMTP_USER=your@gmail.com, SMTP_PASS=16-char Gmail App Password.
 */
export async function sendOtpEmail(to: string, otp: string, username: string) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    console.log(`[mailer] SMTP not configured — OTP for ${to}: ${otp}`);
    return { delivered: false };
  }

  const port = Number(process.env.SMTP_PORT ?? 465);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: process.env.OTP_FROM ?? `Battleground India Store <${user}>`,
    to,
    subject: "Your admin password reset OTP - Battleground India Store",
    text: `Hi ${username},\n\nYour password reset OTP is: ${otp}\nIt is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.`,
    html: `<div style="margin:0;padding:24px;background:#eef1f6;font-family:Arial,sans-serif">
      <div style="max-width:420px;margin:0 auto;background:#ffffff;border:1px solid #dbe2ec;border-radius:14px;padding:28px;color:#0f172a;box-shadow:0 10px 30px rgba(15,40,70,.06)">
        <p style="font-size:11px;letter-spacing:3px;color:#0f4c81;margin:0">BATTLEGROUNDS INDIA STORE</p>
        <h1 style="font-size:22px;margin:14px 0 8px">Password reset OTP</h1>
        <p style="font-size:14px;color:#64748b;line-height:1.6">Hi ${username}, use the OTP below to reset your admin password. It is valid for <b>10 minutes</b>.</p>
        <div style="margin:22px 0;text-align:center;font-size:34px;font-weight:bold;letter-spacing:10px;color:#0f4c81;background:#e0eefb;border:1px dashed #0f4c81;border-radius:10px;padding:18px">${otp}</div>
        <p style="font-size:12px;color:#94a3b8;line-height:1.6">If you did not request this reset, you can safely ignore this email. Never share this OTP with anyone.</p>
      </div>
    </div>`,
  });
  return { delivered: true };
}
