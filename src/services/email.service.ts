const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const getSender = () => ({
  name: (process.env.BREVO_SENDER_NAME || '').trim() || 'MedsSeva',
  email: (process.env.BREVO_SENDER_EMAIL || '').trim() || 'medssevaofficial@gmail.com',
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

function buildWelcomeEmailHtml(userName: string, roleName: string = 'Patient'): string {
  let roleTitle = 'Patient';
  let welcomeBody = 'Thank you for joining MedsSeva. You can now easily book certified blood tests, schedule home sample collections, and access your verified clinical reports anytime on your mobile app.';

  if (roleName === 'Doctor') {
    roleTitle = 'Doctor';
    welcomeBody = 'Thank you for registering with the MedsSeva Clinical Network. Your medical profile and credentials have been received and are currently under review by our medical board. Once approved, you will be able to review patient diagnostic reports, manage digital prescriptions, and view referral insights.';
  } else if (roleName === 'Phlebotomist') {
    roleTitle = 'Phlebotomist';
    welcomeBody = 'Thank you for applying to become a certified MedsSeva Sample Collection Partner. Your application and submitted documents are under review. Once verified by admin, you will be authorized to accept home collection requests and serve patients in your area.';
  } else if (roleName === 'Pathology Partner') {
    roleTitle = 'Pathology Lab Partner';
    welcomeBody = 'Thank you for registering your diagnostic lab with the MedsSeva Partner Network. Your lab details and clinical accreditation documents are under review. Once approved, your laboratory will be listed for diagnostic testing and partner referrals.';
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to MedsSeva</title>
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
              <p style="margin:0 0 8px;font-size:18px;color:#0F766E;font-weight:700;">Welcome to MedsSeva!</p>
              <p style="margin:0 0 16px;font-size:16px;color:#334155;">Hello <strong>${userName}</strong>,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
                ${welcomeBody}
              </p>

              <div style="background:#f0fdfa;border:1px solid #ccfbf1;border-radius:12px;padding:20px;margin-bottom:28px;">
                <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#0F766E;">What you get with MedsSeva:</p>
                <table width="100%" style="font-size:13px;color:#475569;line-height:1.8;">
                  <tr>
                    <td>🧪 <strong>NABL & ISO Accredited Labs</strong></td>
                  </tr>
                  <tr>
                    <td>🏠 <strong>Hassle-Free Home Sample Collection</strong></td>
                  </tr>
                  <tr>
                    <td>📱 <strong>Direct WhatsApp & In-App Report Delivery</strong></td>
                  </tr>
                  <tr>
                    <td>🔒 <strong>100% Confidential Health Records</strong></td>
                  </tr>
                </table>
              </div>

              <p style="margin:0 0 4px;font-size:14px;color:#334155;font-weight:600;">Registered Role:</p>
              <p style="margin:0 0 24px;font-size:14px;color:#0F766E;font-weight:700;">${roleTitle}</p>

              <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;line-height:1.5;">
                If you have any questions or need support, our medical care team is always here to assist you.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#0F766E;">MedsSeva Diagnostics</p>
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

export async function sendWelcomeEmail(toEmail: string, toName: string, roleName: string = 'Patient'): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn('[Welcome Email] BREVO_API_KEY not configured, skipping.');
    return;
  }

  const payload = {
    sender: getSender(),
    to: [{ email: toEmail, name: toName }],
    subject: `Welcome to MedsSeva Diagnostics, ${toName}!`,
    htmlContent: buildWelcomeEmailHtml(toName, roleName),
  };

  try {
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
      console.warn(`[Welcome Email Error] ${response.status}: ${errorBody}`);
    } else {
      console.log(`[Welcome Email] Successfully sent to ${toEmail} (${roleName})`);
    }
  } catch (err: any) {
    console.warn('[Welcome Email Send Error]', err.message);
  }
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

export interface ReportDeliveryDetails {
  patientName: string;
  patientMobile?: string;
  patientEmail?: string;
  testNames: string[];
  reportId: string;
  bookingCode: string;
  reportedDate: string;
  doctorName: string;
  branchName?: string;
  verificationUrl: string;
  pdfUrl?: string | null;
}

function buildReportEmailHtml(details: ReportDeliveryDetails): string {
  const testsList = details.testNames.length > 0 ? details.testNames.join(', ') : 'Diagnostic Pathology';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Diagnostic Lab Report - MedsSeva</title>
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
              <p style="margin:0 0 8px;font-size:16px;color:#334155;">Dear <strong>${details.patientName}</strong>,</p>
              <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6;">
                Your official diagnostic lab report has been finalized and certified by our clinical pathology department.
              </p>

              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
                <table width="100%" style="font-size:13px;color:#334155;">
                  <tr>
                    <td style="padding:4px 0;color:#64748b;">Booking Reference:</td>
                    <td style="padding:4px 0;font-weight:700;text-align:right;">${details.bookingCode}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#64748b;">Investigated Tests:</td>
                    <td style="padding:4px 0;font-weight:700;text-align:right;">${testsList}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#64748b;">Validating Doctor:</td>
                    <td style="padding:4px 0;font-weight:700;text-align:right;">${details.doctorName}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#64748b;">Laboratory:</td>
                    <td style="padding:4px 0;font-weight:700;text-align:right;">${details.branchName || 'MedsSeva Reference Lab'}</td>
                  </tr>
                </table>
              </div>

              <div style="text-align:center;margin-bottom:28px;">
                <a href="${details.verificationUrl}" style="display:inline-block;background:#0F766E;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;letter-spacing:0.5px;">
                  View & Verify Official Report
                </a>
              </div>

              <p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.5;text-align:center;">
                📎 <em>Your official validated PDF report with letterhead and doctor signature is attached to this email.</em>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#0F766E;">MedsSeva Diagnostics</p>
              <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">ISO 15189 & NABL Accredited Laboratory Network</p>
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

export async function sendReportEmail(toEmail: string, details: ReportDeliveryDetails): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured');

  const payload: any = {
    sender: getSender(),
    to: [{ email: toEmail, name: details.patientName }],
    subject: `Your Diagnostic Lab Report (${details.bookingCode}) - MedsSeva Diagnostics`,
    htmlContent: buildReportEmailHtml(details),
  };

  if (details.pdfUrl) {
    payload.attachment = [
      {
        url: details.pdfUrl,
        name: `MedsSeva_Report_${details.bookingCode}.pdf`,
      },
    ];
  }

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
    throw new Error(`Brevo Email error ${response.status}: ${errorBody}`);
  }
}

export async function sendGeneralSms(toMobile: string, content: string): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { sent: false, error: 'BREVO_API_KEY is not configured' };
  }

  let cleanMobile = toMobile.replace(/[^0-9]/g, '');
  if (cleanMobile.length === 10) {
    cleanMobile = `91${cleanMobile}`;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: 'MedsSeva',
        recipient: cleanMobile,
        content,
        type: 'transactional',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`[Brevo SMS Dispatch] HTTP ${response.status}: ${errorBody}`);
      return { sent: false, error: errorBody };
    }

    const data = await response.json();
    return { sent: true, messageId: data.messageId || 'sms_sent' };
  } catch (err: any) {
    console.warn('[Brevo SMS Dispatch Error]', err);
    return { sent: false, error: err.message };
  }
}

export async function sendOtpSms(toMobile: string, otp: string): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const smsText = `Your MedsSeva login OTP is ${otp}. This OTP is valid for 5 minutes. Do not share it with anyone.`;
  return sendGeneralSms(toMobile, smsText);
}

export async function sendReportSMS(toMobile: string, details: ReportDeliveryDetails): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { sent: false, error: 'BREVO_API_KEY is not configured' };
  }

  let cleanMobile = toMobile.replace(/[^0-9]/g, '');
  if (cleanMobile.length === 10) {
    cleanMobile = `91${cleanMobile}`;
  }

  const smsText = `Dear ${details.patientName}, your MedsSeva diagnostic report (${details.bookingCode}) is ready. Verify & download: ${details.verificationUrl}`;

  try {
    const response = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: 'MedsSeva',
        recipient: cleanMobile,
        content: smsText,
        type: 'transactional',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`[SMS Dispatch] Brevo SMS response ${response.status}: ${errorBody}`);
      return { sent: false, error: errorBody };
    }

    const data = await response.json();
    return { sent: true, messageId: data.messageId || 'sms_sent' };
  } catch (err: any) {
    console.warn('[SMS Dispatch Error]', err);
    return { sent: false, error: err.message };
  }
}

export async function sendReportWhatsApp(toMobile: string, details: ReportDeliveryDetails): Promise<{ sent: boolean; shareUrl: string; messageId?: string; error?: string }> {
  let cleanMobile = toMobile.replace(/[^0-9]/g, '');
  if (cleanMobile.length === 10) {
    cleanMobile = `91${cleanMobile}`;
  }

  const pdfSection = details.pdfUrl ? `\n\n📄 *Download Original Signed PDF:*\n${details.pdfUrl}` : '';

  const message = `🏥 *MEDSSEVA DIAGNOSTICS & RESEARCH CENTRE*
_ISO 15189 & NABL Accredited Laboratory Network_
━━━━━━━━━━━━━━━━━━━━━━
Dear *${details.patientName}*,

Your official diagnostic test report has been certified by our clinical pathology department.

📋 *Booking ID:* ${details.bookingCode}
🧪 *Investigation:* ${details.testNames.join(', ') || 'Diagnostic Pathology'}
👨‍⚕️ *Consultant Pathologist:* ${details.doctorName}
━━━━━━━━━━━━━━━━━━━━━━
🔗 *View Digital Report:*
${details.verificationUrl}${pdfSection}
━━━━━━━━━━━━━━━━━━━━━━
_MedsSeva - Smart Diagnostics. Better Care._
_Support: medssevaofficial@gmail.com_`;

  const shareUrl = `https://api.whatsapp.com/send?phone=${cleanMobile}&text=${encodeURIComponent(message)}`;

  const apiKey = process.env.BREVO_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch('https://api.brevo.com/v3/whatsapp/sendMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          recipient: cleanMobile,
          text: message,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return { sent: true, shareUrl, messageId: data.messageId };
      }
    } catch (e) {
      console.warn('[WhatsApp API Dispatch Error]', e);
    }
  }

  return { sent: true, shareUrl };
}