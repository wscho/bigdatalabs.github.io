// Cloudflare Pages Function — POST /api/consult
// 문의 신청 접수 시 Resend API를 통해 담당자에게 이메일로 알림을 발송합니다.
// 필요한 환경 변수(Cloudflare Pages > Settings > Environment variables > Secrets):
//   RESEND_API_KEY    Resend(https://resend.com) API 키
//   NOTIFY_FROM_EMAIL 발신자 이메일 (Resend에 등록/인증된 도메인 주소)
//   NOTIFY_TO_EMAIL   문의를 받을 담당자 이메일

const RESEND_API_URL = "https://api.resend.com/emails";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ success: false, message: "잘못된 요청 형식입니다." }, 400);
  }

  const name = (payload.name || "").toString().trim();
  const phone = (payload.phone || "").toString().trim();
  const email = (payload.email || "").toString().trim();
  const inquiryType = (payload.inquiry_type || "").toString().trim();
  const message = (payload.message || "").toString().trim();

  if (!name || !phone || !inquiryType) {
    return jsonResponse({ success: false, message: "이름, 연락처, 문의 유형은 필수입니다." }, 400);
  }
  if (!["AI.BP 플랫폼 문의", "공동연구/R&D 문의", "기타 문의"].includes(inquiryType)) {
    return jsonResponse({ success: false, message: "문의 유형이 올바르지 않습니다." }, 400);
  }

  const requiredEnv = ["RESEND_API_KEY", "NOTIFY_FROM_EMAIL", "NOTIFY_TO_EMAIL"];
  for (const key of requiredEnv) {
    if (!env[key]) {
      return jsonResponse({ success: false, message: "서버 환경 설정이 완료되지 않았습니다." }, 500);
    }
  }

  const timestamp = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const subject = `[문의신청] ${inquiryType} - ${name}`;
  const html = `
    <h2>새로운 문의가 접수되었습니다</h2>
    <table style="border-collapse: collapse; width: 100%; max-width: 480px;">
      <tr><td style="padding:6px 12px; font-weight:bold; border:1px solid #ddd;">접수 시각</td><td style="padding:6px 12px; border:1px solid #ddd;">${escapeHtml(timestamp)}</td></tr>
      <tr><td style="padding:6px 12px; font-weight:bold; border:1px solid #ddd;">문의 유형</td><td style="padding:6px 12px; border:1px solid #ddd;">${escapeHtml(inquiryType)}</td></tr>
      <tr><td style="padding:6px 12px; font-weight:bold; border:1px solid #ddd;">이름</td><td style="padding:6px 12px; border:1px solid #ddd;">${escapeHtml(name)}</td></tr>
      <tr><td style="padding:6px 12px; font-weight:bold; border:1px solid #ddd;">연락처</td><td style="padding:6px 12px; border:1px solid #ddd;">${escapeHtml(phone)}</td></tr>
      <tr><td style="padding:6px 12px; font-weight:bold; border:1px solid #ddd;">이메일</td><td style="padding:6px 12px; border:1px solid #ddd;">${escapeHtml(email || "-")}</td></tr>
      <tr><td style="padding:6px 12px; font-weight:bold; border:1px solid #ddd; vertical-align:top;">문의 내용</td><td style="padding:6px 12px; border:1px solid #ddd; white-space:pre-wrap;">${escapeHtml(message || "-")}</td></tr>
    </table>
  `;

  try {
    const toList = env.NOTIFY_TO_EMAIL.split(",")
      .map((addr) => addr.trim())
      .filter(Boolean);

    const emailPayload = {
      from: env.NOTIFY_FROM_EMAIL,
      to: toList,
      subject,
      html,
    };
    if (email) {
      emailPayload.reply_to = email;
    }

    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Resend API 오류: ${errText}`);
    }

    return jsonResponse({ success: true, message: "문의가 접수되었습니다." });
  } catch (err) {
    return jsonResponse(
      { success: false, message: "문의 처리 중 오류가 발생했습니다." },
      500
    );
  }
}

export async function onRequestGet() {
  return jsonResponse({ success: false, message: "POST 요청만 지원합니다." }, 405);
}
