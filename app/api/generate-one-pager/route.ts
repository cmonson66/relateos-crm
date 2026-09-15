import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(request: NextRequest) {
  try {
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

    const footerParts = [repData.name, repData.email];
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
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
            .page { width: 8.5in; height: 11in; padding: 0.5in; background: white; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1in; border-bottom: 2px solid #000; padding-bottom: 0.5in; }
            .logo { font-size: 24px; font-weight: bold; }
            .logo-sub { font-size: 12px; color: #666; }
            .header-right { text-align: right; font-size: 12px; }
            h1 { font-size: 32px; margin-bottom: 0.3in; }
            h2 { font-size: 18px; margin-top: 0.3in; margin-bottom: 0.2in; color: #c84a1a; }
            p { font-size: 12px; line-height: 1.6; margin-bottom: 0.2in; }
            .section { margin-bottom: 0.4in; }
            .math-box { background: #f5f5f5; padding: 0.3in; margin: 0.2in 0; font-size: 11px; }
            .footer { background: #1a1a1a; color: white; padding: 0.3in; text-align: center; font-size: 11px; margin-top: 0.5in; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <div>
                <div class="logo">NectarPay</div>
                <div class="logo-sub">Sweeten Every Transaction.</div>
              </div>
              <div class="header-right">
                Independent Ambassadors<br>
                ${repData.location || ''}
              </div>
            </div>

            <h1>Accept crypto with zero processing fees — money in your wallet the second they pay.</h1>

            <p>A small terminal by the register. Your card reader keeps working — this is the no-fee lane beside it.</p>

            <div class="section">
              <h2>The flow</h2>
              <p><strong>1. Your customer</strong> — They scan the code at your register with their own wallet app.</p>
              <p><strong>2. The NectarPay terminal</strong> — Prices the sale, shows the code, confirms the payment, prints the receipt.</p>
              <p><strong>3. Your wallet</strong> — Money lands in seconds. Your keys, your funds — nobody can freeze it or take it back.</p>
              <p><strong>4. Your exchange account</strong> — When you want dollars, you move funds here and cash out. Coinbase, Kraken, whichever you prefer.</p>
              <p><strong>5. Your bank account</strong> — Withdraw to the same business account you already use. Usually one to three business days.</p>
            </div>

            <div class="section">
              <h2>The napkin math</h2>
              <div class="math-box">
                <p><strong>A shop doing $10,000/month on cards:</strong></p>
                <p>Lost to card fees / year ≈ 2-4% = <strong>-$2,400–$4,800</strong></p>
                <p>NectarPay year one, all in = <strong>$799</strong></p>
                <p>Every year after = <strong>$300</strong></p>
                <p><strong style="color: green;">+$2,873 stays in the shop, year one</strong></p>
              </div>
            </div>

            <div class="section">
              <h2>Good to know</h2>
              <p><strong>One-year warranty.</strong> Falls on its own, we replace it. Break it yourself and you buy another.</p>
              <p><strong>Your Wi-Fi.</strong> There is a SIM slot too if you want mobile.</p>
              <p><strong>Receipt printer built in.</strong> You supply thermal paper — a few sheets a week.</p>
              <p><strong>No hardware?</strong> The NectarPay app runs on your phone — you skip the printer and handheld.</p>
            </div>

            <div class="section">
              <h2>Why owners say yes</h2>
              <p><strong>Zero fees on crypto.</strong> The 2-4% card networks take simply is not there.</p>
              <p><strong>Instant settlement.</strong> Money lands in seconds, not business days.</p>
              <p><strong>No chargebacks.</strong> A delivered sale stays sold.</p>
              <p><strong>Non-custodial.</strong> Funds go straight to a wallet YOU own.</p>
              <p><strong>Cards keep working.</strong> This adds a lane, nothing else changes.</p>
            </div>

            <div class="section">
              <h2>Coming next: CryptoPop</h2>
              <p>NectarPay is building a directory showing people who pay crypto, which businesses near them accept it, and what each one is running. A card reader takes money — this is the part that brings someone in.</p>
            </div>

            <div class="footer">
              Want to see it live? Ten minutes at your shop.<br>
              ${footerText}
            </div>
          </div>
        </body>
      </html>
    `;

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'letter', margin: 0 });
    await browser.close();

    const fileName = `nectarpay-onepager-${repData.name?.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}