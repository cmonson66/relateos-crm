import { CRYPTOPOP_CSS } from "./cryptopop-css";

/**
 * A picture of what CryptoPop will look like, for merchants who have just been
 * told a call about it is coming.
 *
 * The markup mirrors cryptopop-preview.html so the standalone file used in
 * presentations and this page cannot drift apart. Styles are namespaced under
 * .cp and injected here rather than written in Tailwind, because this is a
 * deliberate imitation of a maps app and does not share the app's design
 * tokens.
 *
 * The disclaimer below is not decoration. CryptoPop does not exist yet and a
 * convincing screenshot is exactly how someone ends up believing they were
 * promised a listing. It ships with the mockup, always.
 */
export function CryptoPopPreview({ shopName }: { shopName?: string | null }) {
  return (
    <div className="cp">
      <style dangerouslySetInnerHTML={{ __html: CRYPTOPOP_CSS }} />

      <div className="cp-head">
        <div>
          <div className="cp-eyebrow">Coming for merchants who take crypto</div>
          <h2 className="cp-h2">
            {shopName ? `${shopName}, on the map` : "Your shop, on the map"} people check before
            they leave the house.
          </h2>
          <p className="cp-lede">
            CryptoPop shows people paying in crypto which businesses near them accept it, and what
            each one is running that week. Take crypto and you are on it.
          </p>
          <ul className="cp-points">
            <li>You appear to anyone searching nearby, at no extra cost.</li>
            <li>You post the special yourself and change it whenever you want.</li>
            <li>The terminal takes the payment. This is the part that brings someone in.</li>
          </ul>
        </div>

        <div className="phone" role="img" aria-label="Preview of the CryptoPop app: a map of nearby businesses that accept crypto, each pin showing its current offer">
        <div className="screen">

        <div className="statusbar">
        <span>5:11</span>
        <span className="right">Glendale, AZ</span>
        </div>

        <div className="searchrow">
        <div className="search">&#128269; <span>Search</span></div>
        <div className="saved">$8.58</div>
        <div className="avatar">&#128100;</div>
        </div>

        <div className="tabs">
        <div className="tab on">All</div>
        <div className="tab">Coffee</div>
        <div className="tab">Food</div>
        <div className="tab">Retail</div>
        <div className="tab">Services</div>
        <div className="tab">Other</div>
        </div>

        <div className="map">
        <svg viewBox="0 0 352 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="352" height="400" fill="#eef0f2"/>
        <rect x="0" y="0" width="44" height="122" fill="#bcd6ea"/>
        <g fill="#e6e2d8">
        <rect x="62" y="22" width="118" height="88"/>
        <rect x="214" y="38" width="120" height="72"/>
        <rect x="40" y="232" width="96" height="72"/>
        <rect x="202" y="252" width="130" height="88"/>
        </g>
        <g fill="#cfe4cd">
        <rect x="252" y="120" width="78" height="52" rx="3"/>
        <rect x="16" y="326" width="62" height="50" rx="3"/>
        <rect x="150" y="356" width="58" height="42" rx="3"/>
        </g>
        <g stroke="#d8dbde" stroke-width="15">
        <path d="M-8 120 H360"/><path d="M-8 242 H360"/><path d="M-8 348 H360"/>
        <path d="M56 -8 V408"/><path d="M190 -8 V408"/><path d="M304 -8 V408"/>
        </g>
        <g stroke="#ffffff" stroke-width="11">
        <path d="M-8 120 H360"/><path d="M-8 242 H360"/><path d="M-8 348 H360"/>
        <path d="M56 -8 V408"/><path d="M190 -8 V408"/><path d="M304 -8 V408"/>
        </g>
        <g stroke="#ffffff" stroke-width="5">
        <path d="M-8 180 H360"/><path d="M-8 300 H360"/><path d="M124 -8 V408"/><path d="M248 -8 V408"/>
        </g>
        </svg>

        <div className="chips">
        <div className="chip">Sort &#9662;</div>
        <div className="chip">Distance &#9662;</div>
        <div className="chip">Open now</div>
        <div className="chip">Crypto accepted</div>
        </div>

        <div className="maplabel" style={{left: "21%", top: "34%"}}>Peoria</div>
        <div className="maplabel" style={{left: "78%", top: "63%"}}>Arrowhead</div>

        <div className="pin" style={{left: "20%", top: "31%"}}>
        <div className="pill"><span className="ic cafe">&#9749;</span><span className="val">8% back</span></div>
        </div>
        <div className="pin" style={{left: "64%", top: "25%"}}>
        <div className="pill"><span className="ic food">&#127860;</span><span className="val">10% back</span></div>
        </div>
        <div className="pin" style={{left: "87%", top: "40%"}}>
        <div className="pill"><span className="ic shop">&#128717;</span><span className="val">5% back</span></div>
        </div>
        <div className="pin" style={{left: "15%", top: "57%"}}>
        <div className="pill"><span className="ic food">&#127790;</span><span className="val">12% back</span></div>
        </div>
        <div className="pin" style={{left: "38%", top: "47%"}}>
        <div className="pill"><span className="ic svc">&#128135;</span><span className="val">$5 off</span></div>
        </div>
        <div className="pin" style={{left: "74%", top: "74%"}}>
        <div className="pill"><span className="ic cafe">&#9749;</span><span className="val">6% back</span></div>
        </div>
        <div className="pin" style={{left: "29%", top: "81%"}}>
        <div className="pill"><span className="ic shop">&#128717;</span><span className="val">5% back</span></div>
        </div>

        <div className="pin mine" style={{left: "53%", top: "64%"}}>
        <div className="pill"><span className="ic">&#127838;</span><span className="val">10% back &middot; your shop</span></div>
        </div>
        <div className="youdot" style={{left: "53%", top: "68%"}}></div>

        <div className="locate">&#9678;</div>
        </div>

        <div className="offercard">
        <div className="logo">YS</div>
        <div>
        <div className="oc-name">Your Shop</div>
        <div className="oc-meta">0.0 mi &middot; 1850 W Happy Valley Rd</div>
        <div className="oc-offer">10% back when you pay in crypto</div>
        </div>
        <div className="oc-right">
        <div className="instore">Open until 6</div>
        <div className="go">Directions</div>
        </div>
        </div>

        <div className="swipe">
        <div className="grab"></div>
        <span>Swipe up for the full list</span>
        </div>

        <div className="nav">
        <div className="on"><span className="ico">&#128506;</span>Map</div>
        <div><span className="ico">&#128220;</span>Activity</div>
        <div><span className="ico">&#10084;</span>Saved</div>
        </div>

        </div>
        </div>

      </div>

      <div className="cp-note">
        <b>This is a preview, not a live product.</b> CryptoPop is in development. The screen
        above shows how a listing is intended to look so you know what is coming. It is not a
        commitment to a launch date, no listing exists yet, and the businesses and offers shown
        are made up for the example.
      </div>
    </div>
  );
}
