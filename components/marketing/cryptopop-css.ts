export const CRYPTOPOP_CSS = `
.cp{
  --navy:#0c1a2c; --navy-2:#13263d; --honey:#f2a71b; --honey-deep:#b8760a;
  --cream:#f8f4ea; --keep:#1f8a5b; --land:#eef0f2; --label:#6b7280;
}
.cp *{box-sizing:border-box}
/* ---------------- phone ---------------- */
  .cp .phone{width:min(352px,100%);max-width:100%;margin:0 auto;background:#000;border-radius:40px;padding:10px;
    box-shadow:0 40px 80px -30px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.07)}
  .cp .screen{background:var(--land);border-radius:31px;overflow:hidden;position:relative;
    height:min(686px, 128vw);min-height:560px;
    font-family:Inter,system-ui,sans-serif;color:#1f2937}

  .cp .statusbar{display:flex;justify-content:space-between;align-items:center;padding:10px 20px 4px;
    background:#fff;font-size:12px;font-weight:600;color:#111827}
  .cp .statusbar .right{font-size:11px;color:#374151;font-weight:500}

  .cp .searchrow{display:flex;gap:8px;align-items:center;padding:6px 14px 10px;background:#fff}
  .cp .search{flex:1;display:flex;align-items:center;gap:9px;border:1px solid #dfe3e8;border-radius:999px;
    padding:9px 14px;color:#9aa3ad;font-size:14px}
  .cp .saved{border:1px solid #dfe3e8;border-radius:999px;padding:9px 13px;font-size:13.5px;
    font-weight:700;color:var(--keep);white-space:nowrap}
  .cp .avatar{width:38px;height:38px;border-radius:999px;border:1px solid #dfe3e8;display:grid;place-items:center;color:#4b5563}

  .cp .tabs{display:flex;gap:20px;padding:0 16px;background:#fff;border-bottom:1px solid #eceff2;
    overflow-x:auto;scrollbar-width:none}
  .cp .tabs::-webkit-scrollbar{display:none}
  .cp .tab{padding:9px 0 10px;font-size:14px;color:#6b7280;white-space:nowrap}
  .cp .tab.on{color:var(--honey-deep);font-weight:700;box-shadow:inset 0 -3px 0 var(--honey)}

  .cp .map{position:relative;height:400px;background:var(--land);overflow:hidden}
  .cp .map svg{position:absolute;inset:0;width:100%;height:100%}

  .cp .chips{position:absolute;top:11px;left:0;right:0;display:flex;gap:8px;padding:0 12px;
    overflow-x:auto;scrollbar-width:none;z-index:6}
  .cp .chips::-webkit-scrollbar{display:none}
  .cp .chip{background:#fff;border-radius:999px;padding:7px 13px;font-size:12.5px;font-weight:500;
    color:#374151;white-space:nowrap;box-shadow:0 1px 4px rgba(16,24,40,.16)}

  /* offer pins, the callout shape a maps app uses */
  .cp .pin{position:absolute;transform:translate(-50%,-100%);z-index:3}
  .cp .pill{position:relative;display:flex;align-items:center;gap:6px;background:#fff;border-radius:999px;
    padding:4px 11px 4px 4px;box-shadow:0 2px 7px rgba(16,24,40,.26);white-space:nowrap}
  .cp .pill .ic{width:22px;height:22px;border-radius:999px;display:grid;place-items:center;font-size:11px;color:#fff}
  .cp .pill .val{font-size:12.5px;font-weight:700;color:#111827}
  .cp .pin::after{content:"";position:absolute;left:15px;bottom:-4px;width:10px;height:10px;
    background:#fff;transform:rotate(45deg);box-shadow:2px 2px 4px rgba(16,24,40,.12);z-index:-1}
  .cp .ic.food{background:#2f7d4f}
  .cp .ic.shop{background:#6b5cc4}
  .cp .ic.svc{background:#c2761b}
  .cp .ic.cafe{background:#3b7dc4}

  /* the merchant's own shop, shown selected */
  .cp .pin.mine{z-index:5}
  .cp .pin.mine .pill{background:var(--navy);padding-right:13px}
  .cp .pin.mine .val{color:#fff}
  .cp .pin.mine .ic{background:var(--honey);color:var(--navy);font-weight:800}
  .cp .pin.mine::after{background:var(--navy);box-shadow:none}

  .cp .youdot{position:absolute;width:14px;height:14px;border-radius:999px;background:#2563eb;
    border:2.5px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.22);transform:translate(-50%,-50%);z-index:4}
  .cp .locate{position:absolute;right:12px;bottom:14px;width:42px;height:42px;border-radius:999px;background:#fff;
    display:grid;place-items:center;box-shadow:0 2px 8px rgba(16,24,40,.24);color:#2563eb;font-size:17px;z-index:6}
  .cp .maplabel{position:absolute;font-size:10.5px;color:var(--label);font-weight:500;transform:translate(-50%,0);z-index:2}

  .cp .offercard{position:absolute;left:12px;right:12px;bottom:100px;background:#fff;border-radius:15px;
    padding:12px;display:flex;gap:12px;align-items:center;box-shadow:0 6px 22px rgba(16,24,40,.28);z-index:7}
  .cp .logo{width:52px;height:52px;flex:0 0 52px;border-radius:11px;background:var(--navy);
    display:grid;place-items:center;color:var(--honey);font-family:Sora,sans-serif;font-weight:800;font-size:18px}
  .cp .oc-name{font-size:16px;font-weight:700;color:#111827;line-height:1.2}
  .cp .oc-meta{font-size:12px;color:#6b7280;margin-top:1px}
  .cp .oc-offer{font-size:14.5px;font-weight:700;color:var(--keep);margin-top:4px}
  .cp .oc-right{margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;gap:8px}
  .cp .instore{background:#e8f4ec;color:var(--keep);font-size:11px;font-weight:600;border-radius:7px;padding:4px 8px;white-space:nowrap}
  .cp .go{background:var(--honey);color:var(--navy);font-weight:700;font-size:13.5px;border-radius:999px;padding:8px 17px;white-space:nowrap}

  .cp .swipe{position:absolute;left:0;right:0;bottom:56px;background:#fff;border-radius:15px 15px 0 0;
    padding:9px 0 12px;text-align:center;box-shadow:0 -2px 10px rgba(16,24,40,.1);z-index:6}
  .cp .grab{width:40px;height:4px;border-radius:99px;background:#d1d5db;margin:0 auto 7px}
  .cp .swipe span{font-size:13.5px;color:#374151}

  .cp .nav{position:absolute;left:0;right:0;bottom:0;height:56px;background:#fff;border-top:1px solid #eceff2;
    display:flex;align-items:center;justify-content:space-around;z-index:8}
  .cp .nav div{text-align:center;font-size:10.5px;color:#9aa3ad}
  .cp .nav div.on{color:var(--honey-deep);font-weight:700}
  .cp .nav .ico{font-size:16px;display:block;margin-bottom:1px}

  
.cp{margin-top:40px;max-width:100%;overflow:hidden;color:var(--cream);font-family:Inter,system-ui,sans-serif}
.cp-head{display:grid;grid-template-columns:1fr;gap:32px;align-items:center}
/* Grid items are min-width:auto by default, which lets the phone's internals
   push the whole track wider than a phone screen and clip everything. */
.cp-head>*{min-width:0}
@media(min-width:900px){.cp-head{grid-template-columns:1fr 1fr;gap:48px}}
.cp-eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--honey);margin-bottom:10px;font-weight:700}
.cp-h2{overflow-wrap:anywhere;font-size:clamp(22px,5.2vw,34px);font-weight:800;line-height:1.1;letter-spacing:-.02em;margin:0 0 12px;color:var(--cream)}
.cp-lede{font-size:15.5px;color:rgba(248,244,234,.78);margin:0 0 18px;max-width:46ch}
.cp-points{list-style:none;padding:0;margin:0;display:grid;gap:10px}
.cp-points li{position:relative;padding-left:26px;font-size:14.5px;color:rgba(248,244,234,.85)}
.cp-points li:before{content:"";position:absolute;left:0;top:5px;width:15px;height:15px;background:var(--honey);
  clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
.cp-note{margin-top:28px;padding:15px 17px;border-radius:14px;border:1px solid rgba(242,167,27,.3);
  background:rgba(242,167,27,.07);font-size:13px;color:rgba(248,244,234,.82);line-height:1.6}
.cp-note b{color:var(--honey)}
`;
