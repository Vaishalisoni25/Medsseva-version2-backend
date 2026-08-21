const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const getSender = () => ({
  name: (process.env.BREVO_SENDER_NAME || '').trim() || 'vaishalisoni',
  email: (process.env.BREVO_SENDER_EMAIL || '').trim() || 'vaishalisoni02004@gmail.com',
});

function buildOtpEmailHtml(userName: string, otp: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your MedsSeva Account</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0F766E 0%,#0d9488 100%);padding:36px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:1px;">MedsSeva</h1>
              <p style="margin:6px 0 0;color:#99f6e4;font-size:13px;letter-spacing:2px;">SMART DIAGNOSTICS. BETTER CARE.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 24px;">
              <p style="margin:0 0 8px;font-size:16px;color:#334155;">Hello <strong>${userName}</strong>,</p>
              <p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">
                Thank you for choosing MedsSeva. Please use the verification code below to complete your registration.
              </p>
              <div style="background:#f0fdfa;border:2px dashed #0F766E;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 8px;font-size:13px;color:#0F766E;font-weight:600;letter-spacing:2px;">VERIFICATION CODE</p>
                <p style="margin:0;font-size:42px;font-weight:900;color:#0F766E;letter-spacing:10px;">${otp}</p>
              </div>
              <p style="margin:0 0 8px;font-size:14px;color:#64748b;text-align:center;">
                ⏱ This code expires in <strong>5 minutes</strong>.
              </p>
              <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">
                If you didn't request this verification, simply ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#0F766E;">MedsSeva Team</p>
              <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">Smart Diagnostics. Better Care.</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                Support: <a href="mailto:medssevaofficial@gmail.com" style="color:#0F766E;text-decoration:none;">medssevaofficial@gmail.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildPasswordResetEmailHtml(userName: string, otp: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your MedsSeva Password</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0F766E 0%,#0d9488 100%);padding:36px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:1px;">MedsSeva</h1>
              <p style="margin:6px 0 0;color:#99f6e4;font-size:13px;letter-spacing:2px;">SMART DIAGNOSTICS. BETTER CARE.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 24px;">
              <p style="margin:0 0 8px;font-size:16px;color:#334155;">Hello <strong>${userName}</strong>,</p>
              <p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">
                We received a request to reset your MedsSeva password. Use the code below to proceed.
              </p>
              <div style="background:#f0fdfa;border:2px dashed #0F766E;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 8px;font-size:13px;color:#0F766E;font-weight:600;letter-spacing:2px;">PASSWORD RESET CODE</p>
                <p style="margin:0;font-size:42px;font-weight:900;color:#0F766E;letter-spacing:10px;">${otp}</p>
              </div>
              <p style="margin:0 0 8px;font-size:14px;color:#64748b;text-align:center;">
                ⏱ This code expires in <strong>5 minutes</strong>.
              </p>
              <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">
                If you didn't request a password reset, please ignore this email. Your account is safe.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#0F766E;">MedsSeva Team</p>
              <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">Smart Diagnostics. Better Care.</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                Support: <a href="mailto:medssevaofficial@gmail.com" style="color:#0F766E;text-decoration:none;">medssevaofficial@gmail.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendOtpEmail(toEmail: string, toName: string, otp: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured');

  const payload = {
    sender: getSender(),
    to: [{ email: toEmail, name: toName }],
    subject: 'Verify your MedsSeva Account',
    htmlContent: buildOtpEmailHtml(toName, otp),
  };

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Brevo API error ${response.status}: ${errorBody}`);
  }
}

export async function sendPasswordResetEmail(toEmail: string, toName: string, otp: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured');

  const payload = {
    sender: getSender(),
    to: [{ email: toEmail, name: toName }],
    subject: 'Reset your MedsSeva Password',
    htmlContent: buildPasswordResetEmailHtml(toName, otp),
  };

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Brevo API error ${response.status}: ${errorBody}`);
  }
}