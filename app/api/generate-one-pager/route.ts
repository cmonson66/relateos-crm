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
    const footerText = footerParts.join(' · ');

    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; }
            .container { width: 8.5in; height: 11in; display: flex; flex-direction: column; background: white; }
            .header { background: #1a1a1a; color: white; padding: 0.4in 0.5in; }
            .header-title { font-size: 48px; font-weight: bold; color: #ffc60b; letter-spacing: 2px; }
            .header-subtitle { font-size: 14px; color: #ccc; margin-top: 4px; }
            .content { flex: 1; background: white; padding: 0.5in; overflow: hidden; }
            .main-title { font-size: 26px; font-weight: bold; color: #333; margin-bottom: 0.2in; line-height: 1.3; }
            .subtitle { font-size: 14px; color: #666; margin-bottom: 0.3in; }
            .section { margin-bottom: 0.25in; }
            .section-title { 
              font-size: 13px; 
              font-weight: bold; 
              color: #333; 
              border-left: 4px solid #ffc60b; 
              padding-left: 0.15in; 
              margin-bottom: 0.1in;
            }
            .section-content { font-size: 11px; color: #333; line-height: 1.4; margin-left: 0.1in; }
            .bullet { margin-bottom: 0.08in; }
            .footer { background: #1a1a1a; color: white; padding: 0.3in 0.5in; text-align: center; border-top: 4px solid #ffc60b; }
            .footer-label { font-size: 11px; color: #ffc60b; margin-bottom: 4px; }
            .footer-text { font-size: 12px; color: white; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="header-title">NECTAR PAY</div>
              <div class="header-subtitle">Independent Ambassadors</div>
            </div>

            <div class="content">
              <div class="main-title">Accept digital dollars. Keep more of every sale.</div>
              <div class="subtitle">Instant settlement in USDC, straight into the wallet you control.</div>

              <div class="section">
                <div class="section-title">HOW IT FLOWS</div>
                <div class="section-content">
                  <div class="bullet">• Customer pays in USDC from any wallet — scan, confirm, done in seconds.</div>
                  <div class="bullet">• Funds land in the merchant's own wallet. No holds, no batch, no middleman.</div>
                  <div class="bullet">• Merchant cashes out to their bank through their exchange whenever they want.</div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">NAPKIN MATH (ILLUSTRATION)</div>
                <div class="section-content">
                  <div class="bullet">• \$50,000/mo in card volume at ~2.9% + \$0.30 = roughly \$1,500 a month in fees.</div>
                  <div class="bullet">• NectarPay software runs \$24.99 / \$49.99 / \$99.99 a month, billed annually.</div>
                  <div class="bullet">• \$99.99 tier covers up to 10 terminals. Terminal hardware is \$499 each.</div>
                  <div class="bullet">• Every dollar moved to USDC is a dollar that stops paying card interchange.</div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">GOOD TO KNOW</div>
                <div class="section-content">
                  <div class="bullet">• Settlement is instant and final — there are no chargebacks.</div>
                  <div class="bullet">• Network fee on cash-out is pennies, not a percentage of the sale.</div>
                  <div class="bullet">• The merchant holds the keys. NectarPay never custodies their money.</div>
                  <div class="bullet">• Works alongside the existing card terminal — nothing has to be ripped out.</div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">WHY OWNERS SAY YES</div>
                <div class="section-content">
                  <div class="bullet">• They keep more of every ticket instead of handing it to processors.</div>
                  <div class="bullet">• Money is spendable the same day, not in two business days.</div>
                  <div class="bullet">• Setup takes about ten minutes and the first test payment proves it.</div>
                  <div class="bullet">• New crypto-paying customers walk in from the NectarPay merchant map.</div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">COMING NEXT</div>
                <div class="section-content">
                  <div class="bullet">• Loyalty and rewards paid straight to the customer's wallet.</div>
                  <div class="bullet">• Online checkout plugins for the merchant's web store.</div>
                  <div class="bullet">• Local Crypto-Pop events that drive foot traffic to listed merchants.</div>
                </div>
              </div>
            </div>

            <div class="footer">
              <div class="footer-label">Your local NectarPay ambassador</div>
              <div class="footer-text">${footerText}</div>
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