/**
 * Pre-generated QR codes for the install guide.
 *
 * Baked in rather than generated at runtime: these five URLs never change, so
 * a QR library would be a dependency, a bundle and a render cost for output
 * that is identical every time.
 *
 * Two things that are easy to get wrong here, both found by decoding the
 * rendered output rather than trusting the generator:
 *
 * 1. The modules are a STROKED path, not a filled one. Render it with `fill`
 *    and you get a blank square that looks fine in review and scans nothing.
 * 2. The QUIET ZONE is baked into the viewBox (margin 2). Without it the code
 *    only scans when whatever surrounds it happens to be white, which is a
 *    layout accident rather than a guarantee.
 *
 * Verified: all five decode to the right URL when rendered on a grey field.
 * Regenerate with `qrcode` if a URL moves.
 */

export type QrKey = 'mint' | 'bee' | 'np' | 'dash' | 'pair' | 'apk';

export const QR: Record<QrKey, { url: string; viewBox: string; d: string }> = {
  mint: {
    url: 'https://blockchainmint.com/redeem',
    viewBox: '0 0 37 37',
    d: 'M2 2.5h7m2 0h1m1 0h1m1 0h1m5 0h3m1 0h1m2 0h7M2 3.5h1m5 0h1m1 0h1m5 0h2m1 0h1m2 0h1m2 0h2m1 0h1m5 0h1M2 4.5h1m1 0h3m1 0h1m1 0h1m2 0h1m1 0h4m1 0h1m1 0h1m2 0h1m2 0h1m1 0h3m1 0h1M2 5.5h1m1 0h3m1 0h1m2 0h2m3 0h3m1 0h2m1 0h1m1 0h2m1 0h1m1 0h3m1 0h1M2 6.5h1m1 0h3m1 0h1m3 0h1m2 0h1m2 0h3m3 0h3m1 0h1m1 0h3m1 0h1M2 7.5h1m5 0h1m2 0h1m1 0h1m6 0h1m2 0h3m2 0h1m5 0h1M2 8.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M12 9.5h4m1 0h3m1 0h1m2 0h1m1 0h1M3 10.5h3m1 0h2m3 0h1m2 0h1m2 0h2m3 0h1m1 0h1m6 0h2M3 11.5h2m1 0h1m2 0h3m1 0h2m1 0h1m1 0h5m2 0h1m2 0h2m1 0h2m1 0h1M2 12.5h3m2 0h4m2 0h2m1 0h1m3 0h1m2 0h9m1 0h2M2 13.5h2m1 0h1m1 0h1m2 0h2m2 0h2m3 0h1m1 0h1m1 0h3m3 0h1m1 0h1m2 0h1M6 14.5h1m1 0h2m3 0h1m2 0h2m3 0h4m2 0h1m1 0h3m1 0h2M3 15.5h3m3 0h1m6 0h4m2 0h2m1 0h1m3 0h1m2 0h2M3 16.5h1m2 0h1m1 0h4m1 0h1m1 0h4m1 0h3m1 0h1m1 0h1m1 0h1m1 0h2M2 17.5h1m2 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h2m1 0h1m2 0h1m2 0h3m3 0h1M2 18.5h1m2 0h4m1 0h1m1 0h1m1 0h1m2 0h3m2 0h4m1 0h2m1 0h3M2 19.5h1m2 0h1m3 0h1m1 0h1m2 0h2m6 0h1m1 0h5m1 0h2m1 0h2M4 20.5h1m3 0h1m2 0h2m4 0h1m1 0h1m2 0h2m3 0h1m1 0h2m1 0h2M2 21.5h1m2 0h2m7 0h2m1 0h1m2 0h1m3 0h1m1 0h3m1 0h1m2 0h1M2 22.5h3m1 0h10m2 0h1m5 0h2m5 0h3M2 23.5h2m1 0h2m2 0h1m4 0h1m2 0h1m4 0h3m3 0h1m2 0h1m2 0h1M4 24.5h2m1 0h2m1 0h1m1 0h2m1 0h2m3 0h3m5 0h2m2 0h3M3 25.5h1m5 0h2m2 0h2m1 0h1m5 0h1m2 0h7M2 26.5h1m1 0h1m1 0h4m3 0h2m1 0h1m1 0h1m2 0h1m2 0h8M10 27.5h1m2 0h1m1 0h2m3 0h2m1 0h1m1 0h2m3 0h2M2 28.5h7m7 0h1m1 0h4m1 0h1m1 0h2m1 0h1m1 0h1M2 29.5h1m5 0h1m1 0h4m1 0h5m1 0h2m2 0h2m3 0h3m1 0h1M2 30.5h1m1 0h3m1 0h1m3 0h2m3 0h3m1 0h1m2 0h7m1 0h2M2 31.5h1m1 0h3m1 0h1m1 0h2m1 0h2m2 0h1m1 0h3m1 0h2m4 0h1m3 0h2M2 32.5h1m1 0h3m1 0h1m1 0h2m1 0h1m2 0h2m1 0h1m2 0h2m1 0h1m2 0h2M2 33.5h1m5 0h1m1 0h1m3 0h1m4 0h2m1 0h1m1 0h2m1 0h1m1 0h2m3 0h1M2 34.5h7m3 0h1m1 0h1m2 0h1m1 0h3m1 0h1m6 0h1m1 0h1',
  },
  bee: {
    url: 'https://beekeeper.money',
    viewBox: '0 0 33 33',
    d: 'M2 2.5h7m2 0h1m1 0h3m1 0h1m1 0h1m1 0h2m1 0h7M2 3.5h1m5 0h1m1 0h1m1 0h6m3 0h1m2 0h1m5 0h1M2 4.5h1m1 0h3m1 0h1m3 0h1m1 0h1m2 0h2m2 0h1m2 0h1m1 0h3m1 0h1M2 5.5h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m2 0h1m2 0h1m1 0h1m1 0h3m1 0h1M2 6.5h1m1 0h3m1 0h1m1 0h2m1 0h1m3 0h2m1 0h2m2 0h1m1 0h3m1 0h1M2 7.5h1m5 0h1m2 0h1m1 0h3m2 0h1m3 0h1m1 0h1m5 0h1M2 8.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M10 9.5h1m2 0h1m3 0h1m1 0h3M3 10.5h1m1 0h4m1 0h1m1 0h1m2 0h3m3 0h1m1 0h2m1 0h2m1 0h1M3 11.5h1m2 0h1m2 0h1m1 0h1m4 0h1m1 0h3m2 0h1m1 0h3m1 0h1M2 12.5h2m1 0h1m1 0h2m2 0h2m2 0h3m2 0h5m1 0h1M2 13.5h1m3 0h1m3 0h4m2 0h2m1 0h1m1 0h2m3 0h2m2 0h1M2 14.5h1m1 0h1m1 0h5m1 0h1m1 0h1m1 0h1m1 0h1m3 0h3m2 0h1m1 0h1M2 15.5h1m6 0h2m1 0h1m1 0h1m3 0h1m1 0h1m3 0h1m1 0h1m1 0h1m1 0h1M4 16.5h1m2 0h3m2 0h1m3 0h1m1 0h1m1 0h2m1 0h1m1 0h1m1 0h1m1 0h2M2 17.5h1m1 0h2m3 0h1m1 0h1m2 0h1m2 0h1m3 0h4m1 0h3M4 18.5h1m3 0h1m1 0h1m1 0h4m3 0h2m2 0h1m1 0h1m1 0h1m1 0h1M2 19.5h3m2 0h1m3 0h3m1 0h2m2 0h1m4 0h1m1 0h3M2 20.5h2m1 0h2m1 0h1m1 0h1m2 0h4m1 0h2m1 0h1m3 0h1m2 0h1m1 0h1M2 21.5h2m2 0h1m2 0h5m1 0h1m1 0h2m2 0h5m2 0h3M2 22.5h2m1 0h1m2 0h3m1 0h1m1 0h3m1 0h2m1 0h8m1 0h1M10 23.5h1m2 0h1m1 0h1m1 0h1m1 0h2m1 0h1m3 0h4M2 24.5h7m2 0h1m1 0h1m1 0h1m1 0h1m3 0h2m1 0h1m1 0h1m1 0h1M2 25.5h1m5 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h3m3 0h2m1 0h2M2 26.5h1m1 0h3m1 0h1m1 0h2m1 0h1m1 0h3m1 0h1m1 0h6m3 0h1M2 27.5h1m1 0h3m1 0h1m1 0h2m2 0h3m3 0h1m4 0h1m3 0h1M2 28.5h1m1 0h3m1 0h1m8 0h1m4 0h2m1 0h2m1 0h3M2 29.5h1m5 0h1m1 0h2m1 0h2m3 0h1m3 0h2m2 0h3m1 0h1M2 30.5h7m2 0h4m1 0h3m2 0h1m1 0h4',
  },
  np: {
    url: 'https://nectar-pay.com',
    viewBox: '0 0 33 33',
    d: 'M2 2.5h7m3 0h2m1 0h1m1 0h1m1 0h3m2 0h7M2 3.5h1m5 0h1m1 0h1m2 0h1m1 0h1m3 0h2m1 0h1m1 0h1m5 0h1M2 4.5h1m1 0h3m1 0h1m3 0h4m2 0h1m3 0h1m1 0h1m1 0h3m1 0h1M2 5.5h1m1 0h3m1 0h1m1 0h1m1 0h3m1 0h1m1 0h2m1 0h2m1 0h1m1 0h3m1 0h1M2 6.5h1m1 0h3m1 0h1m1 0h2m1 0h1m1 0h1m2 0h2m1 0h1m2 0h1m1 0h3m1 0h1M2 7.5h1m5 0h1m3 0h1m3 0h1m2 0h2m1 0h1m1 0h1m5 0h1M2 8.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M10 9.5h2m1 0h2m6 0h1M3 10.5h1m1 0h4m1 0h3m1 0h1m1 0h3m1 0h5m1 0h2m1 0h1M2 11.5h4m3 0h2m1 0h1m1 0h2m1 0h2m3 0h1m1 0h1m1 0h1m2 0h1M3 12.5h3m1 0h2m1 0h1m2 0h1m1 0h2m1 0h2m3 0h2m1 0h3M4 13.5h2m6 0h1m1 0h3m2 0h2m9 0h1M2 14.5h1m1 0h5m1 0h2m1 0h4m4 0h4m2 0h1m1 0h1M3 15.5h2m1 0h1m3 0h2m2 0h1m1 0h2m1 0h2m3 0h1m1 0h1m1 0h3M3 16.5h1m1 0h2m1 0h5m1 0h1m4 0h1m1 0h1m3 0h1m1 0h1m2 0h1M4 17.5h3m9 0h1m2 0h3m4 0h5M4 18.5h1m1 0h3m3 0h1m1 0h2m2 0h2m1 0h2m1 0h2m1 0h1m1 0h1M2 19.5h1m1 0h4m1 0h1m2 0h1m2 0h1m2 0h3m1 0h1m1 0h1m1 0h3M2 20.5h2m1 0h2m1 0h1m2 0h2m2 0h3m1 0h2m1 0h1m4 0h1m2 0h1M2 21.5h2m3 0h1m6 0h3m6 0h3m2 0h1m1 0h1M2 22.5h3m3 0h1m2 0h2m1 0h2m1 0h1m1 0h1m2 0h7m1 0h1M10 23.5h1m1 0h2m1 0h3m4 0h1m3 0h3M2 24.5h7m7 0h7m1 0h1m1 0h1m1 0h1M2 25.5h1m5 0h1m1 0h1m1 0h5m2 0h1m1 0h2m3 0h2m2 0h1M2 26.5h1m1 0h3m1 0h1m1 0h1m3 0h3m1 0h9m2 0h2M2 27.5h1m1 0h3m1 0h1m1 0h2m1 0h1m1 0h1m2 0h1m6 0h1m1 0h3M2 28.5h1m1 0h3m1 0h1m5 0h1m3 0h3m1 0h2m1 0h2m1 0h3M2 29.5h1m5 0h1m1 0h1m1 0h4m1 0h1m2 0h3m1 0h1m1 0h3m1 0h1M2 30.5h7m4 0h2m5 0h1m1 0h1m2 0h2',
  },
  dash: {
    url: 'https://app.nectar-pay.com/dashboard',
    viewBox: '0 0 37 37',
    d: 'M2 2.5h7m2 0h1m1 0h1m10 0h1m3 0h7M2 3.5h1m5 0h1m1 0h1m1 0h1m1 0h1m3 0h2m1 0h1m1 0h2m1 0h1m1 0h1m5 0h1M2 4.5h1m1 0h3m1 0h1m5 0h4m1 0h3m2 0h2m2 0h1m1 0h3m1 0h1M2 5.5h1m1 0h3m1 0h1m1 0h1m1 0h2m4 0h1m6 0h2m1 0h1m1 0h3m1 0h1M2 6.5h1m1 0h3m1 0h1m1 0h3m2 0h2m3 0h1m1 0h2m1 0h2m1 0h1m1 0h3m1 0h1M2 7.5h1m5 0h1m3 0h1m1 0h1m3 0h3m1 0h1m2 0h2m1 0h1m5 0h1M2 8.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M10 9.5h1m1 0h1m3 0h3m2 0h2m1 0h1M3 10.5h1m1 0h4m1 0h2m1 0h1m1 0h2m2 0h3m4 0h3m1 0h2m1 0h1M2 11.5h1m1 0h2m1 0h1m4 0h2m1 0h2m3 0h2m2 0h2m4 0h3M2 12.5h2m2 0h1m1 0h7m4 0h2m1 0h2m1 0h2m3 0h5M2 13.5h2m1 0h1m1 0h1m1 0h2m4 0h5m9 0h1m2 0h3M3 14.5h2m1 0h1m1 0h2m1 0h2m2 0h10m1 0h1m1 0h2M3 15.5h5m1 0h1m2 0h1m2 0h1m1 0h1m1 0h1m1 0h1m2 0h2m1 0h1m1 0h1m1 0h1M3 16.5h6m3 0h2m1 0h3m6 0h1m1 0h1m1 0h1m2 0h2M2 17.5h2m1 0h1m3 0h1m3 0h3m1 0h1m2 0h2m3 0h3m2 0h1m1 0h1m1 0h1M3 18.5h4m1 0h1m3 0h1m1 0h1m1 0h3m2 0h1m2 0h8M4 19.5h1m1 0h1m3 0h3m1 0h1m2 0h2m2 0h3m2 0h1m1 0h1m1 0h1m1 0h1m1 0h1M5 20.5h2m1 0h1m2 0h1m2 0h3m1 0h1m2 0h1m3 0h5m1 0h2m1 0h1M4 21.5h2m5 0h2m2 0h2m3 0h2m1 0h1m2 0h2m2 0h3M7 22.5h2m1 0h3m1 0h2m1 0h3m2 0h2m7 0h1m1 0h1M2 23.5h1m2 0h2m3 0h1m1 0h1m4 0h3m2 0h1m1 0h2m3 0h3M2 24.5h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h2m1 0h1m4 0h1m2 0h3m2 0h1m4 0h2M2 25.5h1m2 0h3m1 0h3m1 0h1m2 0h1m2 0h2m3 0h4m2 0h1m1 0h1M2 26.5h4m2 0h1m1 0h1m1 0h1m1 0h3m4 0h2m2 0h7m2 0h1M10 27.5h1m3 0h6m2 0h1m2 0h2m3 0h1m1 0h2M2 28.5h7m2 0h2m1 0h2m2 0h4m1 0h4m1 0h1m1 0h1m1 0h1M2 29.5h1m5 0h1m1 0h1m2 0h1m1 0h2m3 0h3m2 0h2m3 0h3M2 30.5h1m1 0h3m1 0h1m1 0h1m3 0h1m3 0h2m2 0h2m1 0h6m2 0h1M2 31.5h1m1 0h3m1 0h1m1 0h3m3 0h1m5 0h1m2 0h3m1 0h1m2 0h1m1 0h1M2 32.5h1m1 0h3m1 0h1m2 0h4m1 0h2m1 0h2m1 0h5m2 0h6M2 33.5h1m5 0h1m1 0h3m2 0h2m2 0h2m3 0h1m4 0h6M2 34.5h7m3 0h3m1 0h1m1 0h3m1 0h1m2 0h2m1 0h3',
  },
  apk: {
    url: 'https://app.nectar-pay.com/pos-apk',
    viewBox: '0 0 33 33',
    d: 'M2 2.5h7m2 0h2m2 0h3m1 0h3m2 0h7M2 3.5h1m5 0h1m3 0h2m1 0h5m2 0h1m1 0h1m5 0h1M2 4.5h1m1 0h3m1 0h1m1 0h3m2 0h1m1 0h1m2 0h1m3 0h1m1 0h3m1 0h1M2 5.5h1m1 0h3m1 0h1m1 0h1m5 0h2m1 0h1m1 0h2m1 0h1m1 0h3m1 0h1M2 6.5h1m1 0h3m1 0h1m1 0h3m4 0h2m1 0h3m1 0h1m1 0h3m1 0h1M2 7.5h1m5 0h1m1 0h2m7 0h2m1 0h1m1 0h1m5 0h1M2 8.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M10 9.5h1m2 0h2m1 0h1m1 0h1M2 10.5h1m1 0h5m2 0h1m2 0h1m4 0h1m4 0h5M2 11.5h2m1 0h3m1 0h2m1 0h2m1 0h3m1 0h8m3 0h1M3 12.5h6m1 0h1m1 0h1m1 0h6m4 0h1M3 13.5h2m1 0h2m2 0h1m2 0h1m1 0h1m7 0h3m1 0h1m1 0h1M2 14.5h1m4 0h2m1 0h3m1 0h1m1 0h1m2 0h1m2 0h1m4 0h2M6 15.5h2m1 0h1m2 0h1m1 0h1m3 0h7m1 0h1m3 0h1M2 16.5h1m1 0h2m1 0h2m3 0h1m4 0h1m4 0h1m3 0h3M2 17.5h1m11 0h1m1 0h2m4 0h1m3 0h1m2 0h1M4 18.5h1m1 0h1m1 0h1m1 0h1m2 0h1m3 0h5m3 0h1m1 0h2M2 19.5h1m1 0h4m1 0h1m1 0h6m1 0h4m1 0h4m1 0h1m1 0h1M2 20.5h1m1 0h7m2 0h1m1 0h5m3 0h1m2 0h1m1 0h1M2 21.5h1m3 0h1m3 0h1m1 0h2m1 0h1m1 0h1m3 0h1m2 0h1m1 0h1m2 0h1M2 22.5h1m2 0h1m2 0h1m1 0h2m1 0h2m1 0h2m1 0h1m2 0h5m1 0h3M10 23.5h1m1 0h3m3 0h1m2 0h2m3 0h5M2 24.5h7m2 0h2m4 0h2m1 0h3m1 0h1m1 0h3M2 25.5h1m5 0h1m1 0h1m1 0h1m3 0h3m1 0h3m3 0h1m2 0h2M2 26.5h1m1 0h3m1 0h1m1 0h2m7 0h1m2 0h5m1 0h2M2 27.5h1m1 0h3m1 0h1m1 0h1m2 0h1m2 0h1m2 0h3m3 0h1m1 0h4M2 28.5h1m1 0h3m1 0h1m1 0h1m1 0h4m1 0h3m4 0h6M2 29.5h1m5 0h1m3 0h3m7 0h1m2 0h3m1 0h1M2 30.5h7m1 0h2m2 0h2m1 0h3m1 0h1m1 0h1m2 0h1m1 0h1',
  },
  pair: {
    url: 'https://app.nectar-pay.com/pos/pair',
    viewBox: '0 0 37 37',
    d: 'M2 2.5h7m3 0h1m1 0h2m2 0h2m3 0h2m3 0h7M2 3.5h1m5 0h1m1 0h2m1 0h2m1 0h2m2 0h2m4 0h1m1 0h1m5 0h1M2 4.5h1m1 0h3m1 0h1m3 0h3m1 0h3m2 0h1m1 0h1m1 0h1m2 0h1m1 0h3m1 0h1M2 5.5h1m1 0h3m1 0h1m1 0h1m5 0h1m1 0h1m1 0h1m1 0h1m1 0h3m1 0h1m1 0h3m1 0h1M2 6.5h1m1 0h3m1 0h1m1 0h2m2 0h1m8 0h3m2 0h1m1 0h3m1 0h1M2 7.5h1m5 0h1m4 0h1m1 0h7m4 0h1m1 0h1m5 0h1M2 8.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M10 9.5h2m2 0h1m2 0h2m5 0h2M3 10.5h1m1 0h4m1 0h1m1 0h2m2 0h2m1 0h2m4 0h4m1 0h2m1 0h1M2 11.5h1m1 0h1m1 0h2m1 0h1m1 0h1m7 0h3m1 0h3m4 0h3M3 12.5h3m1 0h2m2 0h1m10 0h1m1 0h4m2 0h5M5 13.5h1m3 0h1m2 0h1m1 0h5m1 0h1m2 0h2m2 0h3m2 0h3M2 14.5h10m1 0h2m1 0h1m1 0h2m1 0h1m1 0h1m2 0h1m1 0h2M2 15.5h1m2 0h1m3 0h2m2 0h5m1 0h4m3 0h1m4 0h1M2 16.5h2m2 0h3m4 0h1m2 0h1m1 0h5m1 0h1m1 0h1m1 0h1m2 0h2M3 17.5h1m1 0h2m4 0h1m3 0h1m1 0h1m1 0h2m1 0h1m2 0h3m2 0h1m1 0h1m1 0h1M2 18.5h1m1 0h1m1 0h1m1 0h1m1 0h2m2 0h6m4 0h8M2 19.5h3m1 0h2m1 0h6m1 0h1m3 0h3m3 0h1m1 0h1m1 0h1m1 0h1m1 0h1M5 20.5h1m1 0h2m1 0h1m8 0h3m1 0h7m1 0h2m1 0h1M2 21.5h1m3 0h2m2 0h1m3 0h2m2 0h4m2 0h1m1 0h3m1 0h3M2 22.5h3m3 0h1m1 0h1m1 0h3m1 0h2m5 0h2m6 0h1m1 0h1M2 23.5h3m1 0h1m2 0h2m2 0h2m1 0h1m2 0h1m5 0h1m3 0h3M2 24.5h1m1 0h9m1 0h2m1 0h1m2 0h6m2 0h1m1 0h1m2 0h2M2 25.5h1m4 0h1m2 0h3m1 0h1m2 0h1m2 0h3m1 0h4m1 0h1m2 0h3M2 26.5h2m3 0h8m1 0h2m4 0h1m3 0h5m2 0h2M10 27.5h5m2 0h2m3 0h2m1 0h2m3 0h1m1 0h2M2 28.5h7m5 0h1m1 0h2m1 0h3m3 0h2m1 0h1m1 0h1m1 0h1M2 29.5h1m5 0h1m1 0h1m4 0h2m1 0h2m1 0h6m3 0h3M2 30.5h1m1 0h3m1 0h1m1 0h2m2 0h1m1 0h1m2 0h2m2 0h8m2 0h1M2 31.5h1m1 0h3m1 0h1m1 0h3m1 0h2m2 0h3m3 0h4m1 0h1m1 0h2m1 0h1M2 32.5h1m1 0h3m1 0h1m6 0h1m1 0h2m1 0h2m1 0h4m2 0h6M2 33.5h1m5 0h1m1 0h4m4 0h5m1 0h1m2 0h8M2 34.5h7m3 0h3m3 0h1m2 0h2m2 0h2m2 0h2',
  },
};

/** The code plus its label, sized for the guide and for print. */
export function QrBlock({ code, label }: { code: QrKey; label: string }) {
  const q = QR[code];
  return (
    <div className="w-[104px] flex-none text-center">
      <svg
        viewBox={q.viewBox}
        className="mx-auto h-[96px] w-[96px] bg-white"
        shapeRendering="crispEdges"
        role="img"
        aria-label={`QR code for ${q.url}`}
      >
        <path stroke="#0c1a2c" d={q.d} />
      </svg>
      <div className="mt-1 text-[9.5px] font-bold leading-tight text-[#0c1a2c]">{label}</div>
      <div className="break-all font-mono text-[7.5px] leading-tight text-neutral-500">
        {q.url.replace(/^https?:\/\//, '')}
      </div>
    </div>
  );
}
