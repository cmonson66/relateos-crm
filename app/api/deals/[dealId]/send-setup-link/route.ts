// app/api/deals/[dealId]/send-setup-link/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { email, setupUrl, method = "email" } = body;
    const { dealId } = await params;

    if (!email || !setupUrl) {
      return NextResponse.json(
        { error: "Email and setupUrl required" },
        { status: 400 }
      );
    }

    if (method === "email") {
      const subject = "🚀 Your NectarPay Terminal Setup Link";
      const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a1a;">Welcome to NectarPay</h2>
  <p style="color: #666; line-height: 1.6;">
    Your terminal is on its way. Complete your setup in 5 easy steps and start accepting crypto.
  </p>
  
  <div style="background: #f8f7f5; border: 1px solid #e5e5e5; border-radius: 8px; padding: 24px; margin: 24px 0;">
    <p style="margin-top: 0; color: #999; font-size: 14px;">Step 1: Open the Coin</p>
    <p style="margin: 12px 0 0 0; color: #999; font-size: 14px;">Step 2: Create Account</p>
    <p style="margin: 12px 0 0 0; color: #999; font-size: 14px;">Step 3: Link Wallet</p>
    <p style="margin: 12px 0 0 0; color: #999; font-size: 14px;">Step 4: Install App</p>
    <p style="margin: 12px 0 0 0; color: #999; font-size: 14px;">Step 5: Test Payment</p>
  </div>

  <div style="text-align: center; margin: 32px 0;">
    <a href="${setupUrl}" style="background: #f4a520; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
      Start Setup
    </a>
  </div>

  <p style="color: #999; font-size: 12px; margin-top: 32px; border-top: 1px solid #e5e5e5; padding-top: 24px;">
    Or copy this link: <code style="background: #f5f5f5; padding: 2px 4px; border-radius: 2px;">${setupUrl}</code>
  </p>

  <p style="color: #999; font-size: 12px;">
    Questions? Reach out anytime.
  </p>
</body>
</html>
`;

      const result = await resend.emails.send({
        from: `NectarPay <${process.env.NECTARPAY_FROM_EMAIL || "setup@nectarpayaz.com"}>`,
        to: email,
        subject,
        html: htmlBody,
        reply_to: process.env.NECTARPAY_REPLY_TO || "support@nectarpayaz.com",
      });

      if (result.error) {
        console.error("Resend error:", result.error);
        return NextResponse.json(
          { error: "Failed to send email" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Setup link sent via email",
      });
    }

    return NextResponse.json(
      { error: "Invalid send method" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Send setup link error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
