import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function GET(request: NextRequest) {
  let browser;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: repData, error } = await supabase
      .from('admin.users')
      .select('name, email, phone, location')
      .eq('id', userId)
      .single();

    if (error || !repData) {
      return NextResponse.json({ error: 'Rep not found' }, { status: 404 });
    }

    const footerParts: string[] = [];
    if (repData.name) footerParts.push(repData.name);
    if (repData.email) footerParts.push(repData.email);
    if (repData.phone) footerParts.push(repData.phone);
    if (repData.location) footerParts.push(repData.location);
    const footerText = footerParts.filter(p => p).join(' · ');

    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: white; }
            .page { width: 8.5in; height: 11in; padding: 0.4in 0.5in; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.15in; padding-bottom: 0.15in; border-bottom: 2px solid #000; }
            .logo-section { }
            .logo-text { font-size: 24px; font-weight: bold; line-height: 1; }
            .logo-nectarPay { display: inline; }
            .logo-pay { color: #ff9500; }
            .logo-sub { font-size: 10px; color: #666; font-style: italic; }
            .header-right { text-align: right; font-size: 11px; color: #333; }
            .main-title { font-size: 22px; font-weight: bold; line-height: 1.3; margin: 0.2in 0 0.1in 0; }
            .subtitle { font-size: 12px; color: #666; margin-bottom: 0.15in; }
            .flow-section { margin: 0.2in 0; }
            .flow-boxes { display: flex; gap: 0.1in; margin-bottom: 0.15in; }
            .flow-box { flex: 1; border: 1px solid #ddd; padding: 0.12in; background: white; font-size: 9px; }
            .flow-number { display: inline-block; width: 20px; height: 20px; background: #333; color: white; border-radius: 50%; text-align: center; line-height: 20px; font-weight: bold; margin-right: 0.05in; }
            .flow-box-2 { background: #fffaed; border-color: #ffd580; }
            .flow-title { font-weight: bold; margin: 0.05in 0; }
            .section { margin: 0.15in 0; }
            .section-title { font-size: 10px; font-weight: bold; color: #ff9500; letter-spacing: 1px; margin-bottom: 0.08in; }
            .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 0.15in; }
            .column { }
            .napkin-box { background: #f9f9f9; border: 1px solid #ddd; padding: 0.12in; font-size: 10px; }
            .pricing-box { background: #1a1a1a; color: white; padding: 0.12in; font-size: 10px; }
            .pricing-large { font-size: 32px; font-weight: bold; color: #ff9500; }
            .pricing-label { font-size: 9px; color: #ccc; }
            .coming-next-box { border: 2px solid #ffd580; padding: 0.12in; background: #fffef5; font-size: 10px; }
            .coming-next-title { color: #ff9500; font-weight: bold; display: inline; }
            .line { height: 1px; background: #ddd; margin: 0.08in 0; }
            .footer { text-align: center; font-size: 11px; margin-top: 0.2in; padding-top: 0.1in; border-top: 2px solid #000; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <div class="logo-section">
                <div class="logo-text">
                  <span class="logo-nectarPay">Nectar</span><span class="logo-pay">Pay</span>
                </div>
                <div class="logo-sub">Sweeten Every Transaction.</div>
              </div>
              <div class="header-right">
                <div>Independent Ambassadors</div>
                <div>${repData.location || ''}</div>
              </div>
            </div>

            <div class="main-title">Accept crypto with zero processing fees - money in your wallet the second they pay.</div>
            <div class="subtitle">A small terminal by the register. Your card reader keeps working — this is the no-fee lane beside it.</div>

            <div class="flow-section">
              <div class="flow-boxes">
                <div class="flow-box">
                  <div class="flow-number">1</div>
                  <div class="flow-title">Your customer pays</div>
                  <div style="font-size: 8px;">They scan the code at your register with their own wallet app.</div>
                </div>
                <div class="flow-box flow-box-2">
                  <div class="flow-number" style="background: #ff9500;">2</div>
                  <div class="flow-title">The NectarPay terminal</div>
                  <div style="font-size: 8px;">Prices the sale, shows the code, confirms the payment, prints the receipt.</div>
                </div>
                <div class="flow-box">
                  <div class="flow-number">3</div>
                  <div class="flow-title">Your wallet</div>
                  <div style="font-size: 8px;">The money lands here in seconds. Your keys, your funds — nobody can freeze it or take it back.</div>
                </div>
                <div class="flow-box">
                  <div class="flow-number">4</div>
                  <div class="flow-title">Your exchange account</div>
                  <div style="font-size: 8px;">When you want dollars, you move funds here and cash out. Coinbase, Kraken, whichever you prefer.</div>
                </div>
                <div class="flow-box">
                  <div class="flow-number">5</div>
                  <div class="flow-title">Your bank account</div>
                  <div style="font-size: 8px;">Withdraw to the same business account you already use. Usually one to three business days.</div>
                </div>
              </div>
            </div>

            <div class="line"></div>

            <div class="two-column" style="margin: 0.15in 0;">
              <div class="napkin-box">
                <div class="section-title">THE NAPKIN MATH</div>
                <div style="line-height: 1.4;">A shop doing \$10,000/month on cards:</div>
                <div style="margin-top: 0.08in;">
                  Lost to card fees / year (~3%)<span style="float: right; color: #d32f2f;">-\$3,600</span><br>
                  NectarPay year one, all in<span style="float: right;">$799</span><br>
                  <br>
                  Every year after<span style="float: right;">$300</span><br>
                  <br>
                  <strong>Stays in the shop, year one</strong><span style="float: right; color: green;">+\$2,873</span>
                </div>
              </div>
              <div class="pricing-box">
                <div style="display: flex; gap: 0.15in; margin-bottom: 0.08in;">
                  <div><div class="pricing-large">\$499</div><div class="pricing-label">terminal, one-time</div></div>
                  <div><div class="pricing-large">\$24.99</div><div class="pricing-label">/month, billed annually</div></div>
                </div>
                <div style="font-size: 9px; margin: 0.08in 0; color: #ff9500;"><strong>Year one, all in: ~$799  then ~$300/year</strong></div>
                <div style="font-size: 9px; color: #ff9500; margin-bottom: 0.08in;"><strong>No percentage of your sales. Ever.</strong></div>
                <div style="font-size: 8px; color: #aaa;">That is our whole fee. Moving money into a bank costs about 1% through an off-ramp, the same as any exchange — charged on what you move, not on what you ring.</div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">GOOD TO KNOW</div>
              <div class="two-column" style="font-size: 9px; gap: 0.08in;">
                <div>
                  <strong>One-year warranty.</strong> Falls on its own, we replace it. Break it yourself and you buy another.<br><br>
                  <strong>Your Wi-Fi.</strong> There is a SIM slot too if you want mobile.
                </div>
                <div>
                  <strong>Receipt printer built in.</strong> You supply thermal paper — a few dollars anywhere.<br><br>
                  <strong>No hardware?</strong> The NectarPay app runs on your phone — you just skip the printer and handheld.
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">WHY OWNERS SAY YES</div>
              <div class="two-column" style="font-size: 9px; gap: 0.08in;">
                <div>
                  <strong>Zero fees on crypto:</strong> The 2-4% card networks take simply is not there.<br><br>
                  <strong>No chargebacks:</strong> A delivered sale stays sold.<br><br>
                  <strong>Cards keep working:</strong> This adds a lane — nothing else changes.
                </div>
                <div>
                  <strong>Instant settlement:</strong> Money lands in seconds, not business days.<br><br>
                  <strong>Non-custodial:</strong> Funds go straight to a wallet YOU own.<br><br>
                  <strong>Ready for what is next:</strong> Crypto customers pick shops that take it.
                </div>
              </div>
            </div>

            <div class="section">
              <div class="coming-next-box">
                <span class="coming-next-title">COMING NEXT</span> the map that sends crypto customers to your door
              </div>
            </div>

            <div class="footer">
              ${footerText}
            </div>
          </div>
        </body>
      </html>
    `;

    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(htmlTemplate, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'letter',
      margin: { top: 0, bottom: 0, left: 0, right: 0 }
    });
    await browser.close();

    const fileName = `nectarpay-onepager-${repData.name?.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    if (browser) {
      await browser.close();
    }
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}