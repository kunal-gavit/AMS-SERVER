import nodemailer from "nodemailer";

const buildTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

export const sendEmail = async ({ to, subject, text, html }) => {
  const transporter = buildTransporter();

  if (!transporter) {
    return {
      sent: false,
      reason: "SMTP not configured",
      preview: { to, subject, text },
    };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const info = await transporter.sendMail({ from, to, subject, text, html });
  return { sent: true, messageId: info.messageId };
};
