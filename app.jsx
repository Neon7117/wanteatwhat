/* eslint-disable */
// ============================================
// App.jsx — ร้านอาหาร น้าไม่หาร (main React app)
// ============================================

const { useState, useEffect, useMemo, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "peach",
  "darkMode": false,
  "fontScale": 1,
  "cardLayout": "grid"
}/*EDITMODE-END*/;

// ============== Direct source-link resolver ==============
// บาง sourceUrl เป็น "บทความจัดอันดับ / รวมหลายร้าน" — กดเข้าไปแล้วต้องเลื่อนหา
// ว่าร้านนี้อยู่อันดับไหน ไม่ตรงร้าน. ตัวช่วยนี้ตรวจจับลิงก์พวกนั้นแล้วเปลี่ยนให้
// "พาไปร้านนั้นตรงๆ" (ค้นชื่อร้านบน Google → เด้ง knowledge panel ของร้านนั้นทันที)

// สัญญาณที่ 1: URL ที่ถูกใช้ซ้ำโดยหลายร้าน = เป็นบทความรวมร้านแน่นอน
const SHARED_SOURCE_URLS = (() => {
  const count = {};
  (window.RESTAURANTS || []).forEach(x => {
    if (x.sourceUrl) count[x.sourceUrl] = (count[x.sourceUrl] || 0) + 1;
  });
  return new Set(Object.keys(count).filter(u => count[u] > 1));
})();

// สัญญาณที่ 2: รูปแบบ URL ที่เป็นหน้ารวม/จัดอันดับ/หน้าห้าง (ไม่ใช่หน้าร้านเดี่ยว)
const LISTICLE_HINTS = [
  "/food-blog/", "ryoiireview.com/article", "/listings/", "/guides/best-of",
  "best-restaurants", "/places/", "things-to-do", "/recommended-restaurants",
  "food.trueid.net/detail"
];

function isRoundupUrl(url) {
  if (!url) return true;
  if (SHARED_SOURCE_URLS.has(url)) return true;
  return LISTICLE_HINTS.some(h => url.includes(h));
}

// ร้านนี้มี "หน้าร้านจริง" (กดแล้วเจอร้านนั้นเลย ไม่ใช่บทความรวม) หรือไม่
function isDirectSource(r) {
  return !!(r.sourceUrl && !isRoundupUrl(r.sourceUrl));
}

// ============== Cuisine / Format / Price helpers ==============
const CUISINE_CATEGORIES = [
  { id: "all", label: "ทั้งหมด", emoji: "🍽️", match: () => true },
  { id: "thai", label: "ไทย / อีสาน / ใต้", emoji: "🍛", match: c => /ไทย|อีสาน|ใต้|เหนือ|ตามสั่ง|กะเพรา|ข้าวต้ม|ข้าวมันไก่|โบราณ/i.test(c) },
  { id: "japanese", label: "ญี่ปุ่น", emoji: "🍣", match: c => /ญี่ปุ่น|ราเมน|ราเมง|ซูชิ|อิซากายะ|ทงคัตสึ|แกงกะหรี่ญี่ปุ่น|ยากินิคุ|เกี๊ยวซ่า|สุกี้ยากี้/i.test(c) },
  { id: "korean", label: "เกาหลี", emoji: "🇰🇷", match: c => /เกาหลี|รามยอน|Busan|Korean/i.test(c) },
  { id: "chinese", label: "จีน", emoji: "🥟", match: c => /จีน|ติ่มซำ|ก๋วยเตี๋ยว|บะหมี่|ฮ่องกง|กวางตุ้ง/i.test(c) && !/ญี่ปุ่น|ไทย/i.test(c) },
  { id: "italian", label: "อิตาเลียน", emoji: "🍝", match: c => /อิตาเลียน|พิซซ่า|พาสต้า|Italian|Pizza/i.test(c) },
  { id: "shabu", label: "ชาบู / สุกี้", emoji: "🍲", match: c => /ชาบู|สุกี้|หม้อไฟ|Shabu/i.test(c) },
  { id: "bbq", label: "ปิ้งย่าง / Wagyu", emoji: "🥩", match: c => /ปิ้งย่าง|Wagyu|วากิว|เนื้อย่าง|Yakiniku|BBQ|โกเบ|Kobe|สเต๊ก|Steak/i.test(c) },
  { id: "buffet", label: "บุฟเฟ่ต์", emoji: "🍱", match: c => /บุฟเฟ่|Buffet/i.test(c) },
  { id: "international", label: "นานาชาติ / ฟิวชั่น", emoji: "🌍", match: c => /นานาชาติ|ฟิวชั่น|เลบานอน|กรีก|เยอรมัน|เวียดนาม|อินเดีย|Brunch|คาเฟ่|Fine Dining|Rooftop|Lebanese|Greek/i.test(c) }
];

function getCuisineCategoryId(restaurant) {
  for (const cat of CUISINE_CATEGORIES) {
    if (cat.id === "all") continue;
    if (cat.match(restaurant.cuisine)) return cat.id;
  }
  return "international";
}

function isBuffet(restaurant) {
  return /บุฟเฟ่|Buffet/i.test(restaurant.cuisine + " " + restaurant.name);
}

const PRICE_LEVELS = [
  { id: "all", label: "ทุกราคา", emoji: "💰" },
  { id: "1", label: "< ฿200", emoji: "💵", desc: "< ฿200/คน" },
  { id: "2", label: "฿200-400", emoji: "💵", desc: "฿200-400/คน" },
  { id: "3", label: "฿400-700", emoji: "💴", desc: "฿400-700/คน" },
  { id: "4", label: "฿700-1,200", emoji: "💴", desc: "฿700-1,200/คน" },
  { id: "5", label: "> ฿1,200", emoji: "💶", desc: "> ฿1,200/คน" }
];

function getPriceLevel(restaurant) {
  return String(restaurant.priceRange.length);
}

// ============== Utility components ==============
function StarRating({ rating }) {
  return (
    <span className="rank-rating">
      <span className="star">★</span> {rating.toFixed(1)}
    </span>
  );
}

function HoursCell({ hours }) {
  // shorten common patterns for display
  const short = hours
    .replace(/ทุกวัน/, "📅")
    .replace(/น\./g, "")
    .trim();
  return (
    <div className="hours-cell" title={hours}>
      <span className="hours-icon">🕒</span>
      <span className="hours-text">{short}</span>
    </div>
  );
}

function GmapLinkBtn({ url, small }) {
  return (
    <a href={url} target="_blank" rel="noopener" className={"gmap-btn" + (small ? " gmap-btn-sm" : "")} onClick={(e) => e.stopPropagation()} title="เปิดใน Google Maps">
      <span>📍</span>{small ? "" : " Maps"}
    </a>
  );
}

function AreaBadge({ areaId }) {
  const area = AREAS.find(a => a.id === areaId);
  if (!area) return null;
  return (
    <span className="rank-area-badge">
      <span>{area.emoji}</span> {area.label}
    </span>
  );
}

// ============== Modal ==============
function RestaurantModal({ restaurant, onClose }) {
  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!restaurant) return null;
  const r = restaurant;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-cover">
          <span className="modal-cover-emoji">{r.emoji}</span>
          <button className="modal-close" onClick={onClose} aria-label="ปิด">✕</button>
        </div>
        <div className="modal-body">
          <div className="top3-area-badge"><AreaBadge areaId={r.area} /></div>
          <h3 className="modal-title">{r.name}</h3>
          <div className="modal-cuisine">{r.cuisine}</div>

          <div className="modal-stats">
            <div className="modal-stat"><span className="k">Rating</span><span className="v"><span style={{color:"#E8B440"}}>★</span> {r.rating} ({r.reviewCount.toLocaleString()} รีวิว)</span></div>
            <div className="modal-stat"><span className="k">ราคา/คน</span><span className="v">{r.pricePerPerson}</span></div>
            <div className="modal-stat"><span className="k">เดินทาง</span><span className="v">{r.travel}</span></div>
            <div className="modal-stat"><span className="k">เวลาเปิด</span><span className="v">{r.hours}</span></div>
            <div className="modal-stat"><span className="k">เหมาะกลุ่ม</span><span className="v">{r.groupFriendly}</span></div>
            <div className="modal-stat"><span className="k">คะแนนรวม</span><span className="v" style={{color:"var(--primary)"}}>{r.scores.total}/100</span></div>
          </div>

          <div className="modal-section">
            <h4>ที่อยู่ Address</h4>
            <p>{r.address}</p>
          </div>

          <div className="modal-section">
            <h4>หมายเหตุ Notes</h4>
            <p style={{color:"var(--text-muted)"}}>{r.notes}</p>
          </div>

          <div className="modal-section">
            <h4>เมนูเด่น Signature</h4>
            <div className="signature-list">
              {r.signature.map(s => <span key={s} className="signature-pill">{s}</span>)}
            </div>
          </div>

          {r.gmapReview && r.gmapReview.length > 0 && (
            <div className="modal-section">
              <h4>⭐ รีวิวจาก Google Maps</h4>
              <div className="gmap-reviews">
                {r.gmapReview.map((rev, i) => (
                  <div key={i} className="gmap-review">
                    <div className="gmap-review-head">
                      <span className="gmap-review-author">{rev.author}</span>
                      <span className="gmap-review-stars">
                        {Array.from({length: rev.rating}).map((_, j) => <span key={j} style={{color:"#E8B440"}}>★</span>)}
                        {Array.from({length: 5 - rev.rating}).map((_, j) => <span key={"e"+j} style={{color:"var(--border)"}}>★</span>)}
                      </span>
                    </div>
                    <p className="gmap-review-text">“{rev.text}”</p>
                  </div>
                ))}
              </div>
              <a href={r.gmapUrl} target="_blank" rel="noopener" className="evidence-link">
                📍 ดูรีวิวทั้งหมดบน Google Maps
              </a>
            </div>
          )}

          <div className="modal-section">
            <h4>คะแนนรายหมวด Score Breakdown</h4>
            <div className="score-breakdown">
              {SCORING_CRITERIA.map(c => {
                const v = r.scores[c.id];
                const pct = (v / c.weight) * 100;
                return (
                  <div className="score-bar-row" key={c.id}>
                    <span className="score-bar-label">{c.labelTh}</span>
                    <div className="score-bar-track">
                      <div className="score-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="score-bar-num">{v}/{c.weight}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="modal-section">
            <h4>แหล่งข้อมูล Source</h4>
            <p>{r.source}</p>
            <div style={{display:"flex", gap:"0.5rem", flexWrap:"wrap", marginTop:"0.5rem"}}>
              <a href={r.gmapUrl} target="_blank" rel="noopener" className="evidence-link">
                📍 ดูร้านนี้บน Google Maps
              </a>
              {isDirectSource(r) && (
                <a href={r.sourceUrl} target="_blank" rel="noopener" className="evidence-link">
                  🔗 หน้าร้านต้นทาง
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== Tweaks Panel ==============
function TweaksPanel({ tweaks, setTweak, onClose }) {
  return (
    <div className="tweaks-panel" data-screen-label="Tweaks">
      <div className="tweaks-head">
        <span className="tweaks-title">✨ Tweaks</span>
        <button className="icon-btn" onClick={onClose} style={{width:28, height:28, fontSize:"0.85rem"}}>✕</button>
      </div>
      <div className="tweaks-body">
        <div className="tweaks-section">
          <div className="tweaks-label">โทนสีพาสเทล</div>
          <div className="palette-row">
            {[
              { id: "peach", colors: ["#E07A5F", "#F4A582", "#F0B49B", "#FFEEE2"] },
              { id: "mint", colors: ["#6FA98A", "#97C7AC", "#C2DECC", "#EAF7EE"] },
              { id: "lavender", colors: ["#9572B7", "#BCA3D1", "#D6C2E2", "#EFE6F2"] },
              { id: "sunset", colors: ["#E3826B", "#F2B59D", "#FFD0A8", "#FFE3D1"] },
            ].map(p => (
              <button
                key={p.id}
                className={"palette-swatch" + (tweaks.palette === p.id ? " active" : "")}
                style={{
                  background: `linear-gradient(135deg, ${p.colors[0]} 0%, ${p.colors[1]} 50%, ${p.colors[2]} 100%)`
                }}
                onClick={() => setTweak("palette", p.id)}
                aria-label={p.id}
                title={p.id}
              />
            ))}
          </div>
        </div>

        <div className="tweaks-section">
          <div className="tweaks-label">โหมดสว่าง/มืด</div>
          <div className="layout-toggle">
            <button
              className={"layout-toggle-btn" + (!tweaks.darkMode ? " active" : "")}
              onClick={() => setTweak("darkMode", false)}
            >☀️ สว่าง</button>
            <button
              className={"layout-toggle-btn" + (tweaks.darkMode ? " active" : "")}
              onClick={() => setTweak("darkMode", true)}
            >🌙 มืด</button>
          </div>
        </div>

        <div className="tweaks-section">
          <div className="tweaks-label">Layout การ์ด Top 3</div>
          <div className="layout-toggle">
            <button
              className={"layout-toggle-btn" + (tweaks.cardLayout === "grid" ? " active" : "")}
              onClick={() => setTweak("cardLayout", "grid")}
            >Grid</button>
            <button
              className={"layout-toggle-btn" + (tweaks.cardLayout === "stack" ? " active" : "")}
              onClick={() => setTweak("cardLayout", "stack")}
            >Stack</button>
          </div>
        </div>

        <div className="tweaks-section">
          <div className="tweaks-label">ขนาดตัวอักษร · {Math.round(tweaks.fontScale * 100)}%</div>
          <input
            type="range" min="0.85" max="1.2" step="0.05"
            value={tweaks.fontScale}
            onChange={(e) => setTweak("fontScale", parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}

// ============== Header ==============
function Hero({ examineeName, areas }) {
  const today = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  return (
    <header className="hero" data-screen-label="Hero">
      <div className="hero-deco" />
      <div className="hero-content">
        <div className="hero-emojis">🍜 🍣 🥗 🍕 🥘</div>
        <h1 className="hero-title">ร้านอาหาร น้าไม่หาร</h1>
        <p className="hero-subtitle">
          AI Workflow ช่วยเลือกร้านอาหารสำหรับทีม <strong>8–12 คน</strong> ใน 5 ย่านใจกลางกรุงเทพ
          วิเคราะห์จากข้อมูลจริง รีวิวจริง และคะแนน 100 คะแนนตามเกณฑ์
        </p>
        <div className="hero-meta">
          <span className="meta-pill"><span className="meta-key">ย่าน</span><span className="meta-val">{areas.map(a => a.label).join(" · ")}</span></span>
          <span className="meta-pill"><span className="meta-key">ผู้ทำ</span><span className="meta-val">{examineeName}</span></span>
          <span className="meta-pill"><span className="meta-key">วันที่</span><span className="meta-val">{today}</span></span>
          <span className="meta-pill"><span className="meta-key">ร้าน</span><span className="meta-val">{RESTAURANTS.length} ร้าน</span></span>
        </div>
      </div>
    </header>
  );
}

// ============== Objective ==============
function Objective() {
  return (
    <section className="section" id="objective" data-screen-label="Objective">
      <div className="section-tag">🎯 Objective</div>
      <h2 className="section-title">เป้าหมายของ Workflow</h2>
      <p className="section-subtitle">เราต้องตอบคำถามนี้ให้ทีมได้แบบมั่นใจ ภายในไม่กี่นาที</p>
      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title">📋 คำถามหลัก</h3>
          <p style={{color:"var(--text-muted)", lineHeight: 1.7}}>
            <em>"ถ้าทีม 8–12 คนต้องเลือกร้านอาหาร 1–3 ร้าน จากพื้นที่ที่กำหนด <strong>ร้านไหนเหมาะที่สุด</strong> และเพราะอะไร?"</em>
          </p>
        </div>
        <div className="card">
          <h3 className="card-title">🎯 เป้าหมาย</h3>
          <p style={{color:"var(--text-muted)", lineHeight: 1.7}}>
            สร้าง workflow ที่ใช้ <strong>ข้อมูลจริง + AI</strong> เพื่อค้นหา วิเคราะห์ ให้คะแนน
            และแนะนำร้านอาหารแบบมีหลักฐานตรวจสอบได้ ไม่ใช่แค่ "ความรู้สึก"
          </p>
        </div>
        <div className="card">
          <h3 className="card-title">🍽️ สถานการณ์</h3>
          <p style={{color:"var(--text-muted)", lineHeight: 1.7}}>
            ทีมงาน 8–12 คน นัดมื้อเย็น <strong>หลังเลิกงาน</strong> ต้องการร้านที่นั่งสบาย
            มีพื้นที่พอ บรรยากาศคุยกันได้ ราคาสมเหตุสมผล และเดินทางสะดวก
          </p>
        </div>
        <div className="card">
          <h3 className="card-title">🚇 พื้นที่เลือกได้</h3>
          <div style={{display:"flex", flexWrap:"wrap", gap:"0.5rem", marginTop:"0.6rem"}}>
            {AREAS.map(a => (
              <span key={a.id} className="rank-area-badge" style={{fontSize:"0.85rem", padding:"0.35rem 0.85rem"}}>
                {a.emoji} {a.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============== Workflow Section ==============
function WorkflowSection() {
  return (
    <section className="section" id="workflow" data-screen-label="Workflow">
      <div className="section-tag">⚙️ Workflow</div>
      <h2 className="section-title">ขั้นตอนทั้งหมด 8 ขั้น</h2>
      <p className="section-subtitle">ตั้งแต่ scraping → AI analysis → automation → HTML output</p>

      <div className="diagram">
        <div className="diagram-flow">
          <span className="diagram-node">🔍 Apify Scrape</span>
          <span className="diagram-arrow">→</span>
          <span className="diagram-node">📊 Google Sheets</span>
          <span className="diagram-arrow">→</span>
          <span className="diagram-node">✨ Claude Clean+Score</span>
          <span className="diagram-arrow">→</span>
          <span className="diagram-node">⚙️ n8n Automation</span>
          <span className="diagram-arrow">→</span>
          <span className="diagram-node">🎨 HTML Report</span>
        </div>
      </div>

      <div className="workflow-list" style={{marginTop:"2rem"}}>
        {WORKFLOW.map(w => (
          <div className="workflow-step" key={w.step}>
            <div className="workflow-num">{w.step}</div>
            <div className="workflow-icon">{w.icon}</div>
            <div className="workflow-title">{w.title}</div>
            <div className="workflow-desc">{w.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============== Tools Section ==============
function ToolsSection() {
  return (
    <section className="section" id="tools" data-screen-label="Tools">
      <div className="section-tag">🛠️ Tools Used</div>
      <h2 className="section-title">เครื่องมือที่ใช้</h2>
      <p className="section-subtitle">ตาม Tech Stack ที่กำหนด — ทุกเครื่องมือมีหลักฐาน prompt/screenshot/dataset</p>
      <div className="grid grid-2">
        {TOOLS.map(t => (
          <div className="tool-card" key={t.name}>
            <div className="tool-icon">{t.icon}</div>
            <div>
              <div className="tool-cat">{t.category}</div>
              <div className="tool-name">{t.name}</div>
              <div className="tool-role">{t.role}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============== Data Sources Section ==============
function DataSourcesSection() {
  return (
    <section className="section" id="sources" data-screen-label="Sources">
      <div className="section-tag">📚 Data Sources</div>
      <h2 className="section-title">แหล่งข้อมูล {DATA_SOURCES.length} แหล่ง</h2>
      <p className="section-subtitle">ทุกร้านมีลิงก์ไปต้นทาง ตรวจย้อนกลับได้</p>
      <div className="grid grid-2">
        {DATA_SOURCES.map(s => (
          <a key={s.name} href={s.url} target="_blank" rel="noopener" className="source-card">
            <div className="source-logo">{s.logo}</div>
            <div className="source-info">
              <div className="source-name">{s.name}</div>
              <div className="source-desc">{s.desc}</div>
            </div>
            <div className="source-arrow">↗</div>
          </a>
        ))}
      </div>
    </section>
  );
}

// ============== Scoring Section ==============
function ScoringSection() {
  return (
    <section className="section" id="scoring" data-screen-label="Scoring">
      <div className="section-tag">⭐ Scoring Model</div>
      <h2 className="section-title">เกณฑ์การให้คะแนน 100 คะแนน</h2>
      <p className="section-subtitle">น้ำหนักตามโจทย์กำหนด — ห้ามเปลี่ยน</p>
      <div className="scoring-table">
        <div className="scoring-row head">
          <div>หมวด</div>
          <div style={{textAlign:"center"}}>คะแนน</div>
          <div>รายละเอียด</div>
        </div>
        {SCORING_CRITERIA.map(c => (
          <div className="scoring-row" key={c.id}>
            <div className="scoring-label">
              {c.labelTh}
              <small>{c.label}</small>
            </div>
            <div className="scoring-weight">{c.weight}</div>
            <div className="scoring-desc">{c.desc}</div>
          </div>
        ))}
        <div className="scoring-row total">
          <div>รวม</div>
          <div style={{textAlign:"center", fontFamily:"var(--font-display)", fontSize:"1.5rem"}}>100</div>
          <div>คะแนนเต็มของระบบ</div>
        </div>
      </div>
    </section>
  );
}

// ============== Top 10 Table Section ==============
function Top10Section({ onOpen }) {
  const [areaFilter, setAreaFilter] = useState("all");
  const [cuisineFilter, setCuisineFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all"); // all | buffet | alacarte
  const [priceFilter, setPriceFilter] = useState("all");
  const [sortKey, setSortKey] = useState("total");
  const [limit, setLimit] = useState(10);

  const filtered = useMemo(() => {
    let list = RESTAURANTS.slice();
    if (areaFilter !== "all") list = list.filter(r => r.area === areaFilter);
    if (cuisineFilter !== "all") list = list.filter(r => getCuisineCategoryId(r) === cuisineFilter);
    if (formatFilter === "buffet") list = list.filter(r => isBuffet(r));
    if (formatFilter === "alacarte") list = list.filter(r => !isBuffet(r));
    if (priceFilter !== "all") list = list.filter(r => getPriceLevel(r) === priceFilter);
    list.sort((a, b) => {
      if (sortKey === "total") return b.scores.total - a.scores.total;
      if (sortKey === "rating") return b.rating - a.rating;
      if (sortKey === "price") return a.priceRange.length - b.priceRange.length;
      if (sortKey === "reviews") return b.reviewCount - a.reviewCount;
      return 0;
    });
    return list;
  }, [areaFilter, cuisineFilter, formatFilter, priceFilter, sortKey]);

  const displayed = filtered.slice(0, limit);
  const countByArea = useMemo(() => {
    const counts = { all: RESTAURANTS.length };
    AREAS.forEach(a => { counts[a.id] = RESTAURANTS.filter(r => r.area === a.id).length; });
    return counts;
  }, []);
  const countByCuisine = useMemo(() => {
    const counts = {};
    CUISINE_CATEGORIES.forEach(c => {
      counts[c.id] = c.id === "all" ? RESTAURANTS.length : RESTAURANTS.filter(r => getCuisineCategoryId(r) === c.id).length;
    });
    return counts;
  }, []);

  const resetFilters = () => {
    setAreaFilter("all"); setCuisineFilter("all"); setFormatFilter("all"); setPriceFilter("all");
  };
  const hasFilters = areaFilter !== "all" || cuisineFilter !== "all" || formatFilter !== "all" || priceFilter !== "all";

  return (
    <section className="section" id="top10" data-screen-label="Top 10">
      <div className="section-tag">🏆 Top 10 Ranking</div>
      <h2 className="section-title">จัดอันดับร้านอาหาร {RESTAURANTS.length} ร้าน</h2>
      <p className="section-subtitle">กรองตามย่าน ประเภทอาหาร รูปแบบ (Buffet / A La Carte) และราคา — คลิกแถวเพื่อดูรายละเอียด</p>

      {/* Filter: Area */}
      <div className="filter-block">
        <div className="filter-label">📍 ย่าน</div>
        <div className="tab-bar" role="tablist">
          <button className={"tab" + (areaFilter === "all" ? " active" : "")} onClick={() => setAreaFilter("all")}>
            <span>🍽️</span> ทั้งหมด <span className="tab-count">{countByArea.all}</span>
          </button>
          {AREAS.map(a => (
            <button key={a.id} className={"tab" + (areaFilter === a.id ? " active" : "")} onClick={() => setAreaFilter(a.id)}>
              <span>{a.emoji}</span> {a.label} <span className="tab-count">{countByArea[a.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filter: Cuisine */}
      <div className="filter-block">
        <div className="filter-label">🍱 ประเภทอาหาร</div>
        <div className="tab-bar small-tabs">
          {CUISINE_CATEGORIES.map(c => (
            <button key={c.id} className={"tab" + (cuisineFilter === c.id ? " active" : "")} onClick={() => setCuisineFilter(c.id)}>
              <span>{c.emoji}</span> {c.label} <span className="tab-count">{countByCuisine[c.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filter: Format + Price (2 columns) */}
      <div className="filter-row">
        <div className="filter-block half">
          <div className="filter-label">🍽️ รูปแบบ</div>
          <div className="seg-control">
            {[
              { id: "all", label: "ทั้งหมด", icon: "🍴" },
              { id: "alacarte", label: "A La Carte", icon: "📋" },
              { id: "buffet", label: "บุฟเฟ่ต์", icon: "🍱" }
            ].map(f => (
              <button key={f.id} className={"seg-btn" + (formatFilter === f.id ? " active" : "")} onClick={() => setFormatFilter(f.id)}>
                <span>{f.icon}</span> {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-block half">
          <div className="filter-label">💰 ช่วงราคา / คน</div>
          <div className="seg-control">
            {PRICE_LEVELS.map(p => (
              <button
                key={p.id}
                className={"seg-btn" + (priceFilter === p.id ? " active" : "")}
                onClick={() => setPriceFilter(p.id)}
                title={p.desc || p.label}
              >
                {p.id === "all" ? <><span>{p.emoji}</span> {p.label}</> : <span style={{fontFamily:"var(--font-display)", fontWeight:700}}>{p.label}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="ranking-controls">
        <span style={{color:"var(--text-muted)", fontSize:"0.85rem", fontWeight:600}}>เรียงตาม:</span>
        {[
          { id: "total", label: "คะแนนรวม", icon: "⭐" },
          { id: "rating", label: "Rating", icon: "★" },
          { id: "reviews", label: "จำนวนรีวิว", icon: "💬" },
          { id: "price", label: "ราคา (ถูก→แพง)", icon: "💰" }
        ].map(s => (
          <button key={s.id} className={"sort-btn" + (sortKey === s.id ? " active" : "")} onClick={() => setSortKey(s.id)}>
            <span>{s.icon}</span> {s.label}
          </button>
        ))}
        <span style={{flex:1}} />
        <span style={{color:"var(--text-muted)", fontSize:"0.85rem"}}>
          พบ <strong style={{color:"var(--accent)"}}>{filtered.length}</strong> ร้าน
        </span>
        {hasFilters && (
          <button className="sort-btn" onClick={resetFilters} title="ล้างตัวกรอง">
            ✕ ล้าง
          </button>
        )}
      </div>

      <div className="ranking-table">
        <div className="ranking-header">
          <div style={{textAlign:"center"}}>#</div>
          <div>ร้าน</div>
          <div>ย่าน</div>
          <div style={{textAlign:"center"}}>Rating</div>
          <div style={{textAlign:"center"}}>ราคา</div>
          <div style={{textAlign:"center"}}>คะแนน</div>
          <div>เวลาเปิด-ปิด</div>
          <div style={{textAlign:"center"}}>Maps</div>
        </div>
        {displayed.map((r, i) => (
          <div
            key={r.id}
            className={"ranking-row" + (i < 3 && sortKey === "total" && !hasFilters ? " top-3" : "")}
            onClick={() => onOpen(r)}
          >
            <div className={"rank-num" + (i === 0 ? " gold" : i === 1 ? " silver" : i === 2 ? " bronze" : "")}>
              {i + 1}
            </div>
            <div className="rank-info">
              <div className="rank-emoji">{r.emoji}</div>
              <div style={{minWidth:0}}>
                <div className="rank-name">{r.name}</div>
                <div className="rank-cuisine">{r.cuisine}{isBuffet(r) ? " · บุฟเฟ่ต์" : ""}</div>
              </div>
            </div>
            <div><AreaBadge areaId={r.area} /></div>
            <div style={{textAlign:"center"}}>
              <StarRating rating={r.rating} />
              <div style={{fontSize:"0.72rem", color:"var(--text-muted)"}}>{r.reviewCount.toLocaleString()} รีวิว</div>
            </div>
            <div className="rank-cell rank-price" style={{textAlign:"center"}}>
              <div className="price-num">{r.pricePerPerson}</div>
            </div>
            <div className="rank-score">{r.scores.total}</div>
            <div><HoursCell hours={r.hours} /></div>
            <div style={{textAlign:"center"}}><GmapLinkBtn url={r.gmapUrl} small /></div>
          </div>
        ))}
        {displayed.length === 0 && (
          <div style={{padding:"3rem 1.5rem", textAlign:"center", color:"var(--text-muted)"}}>
            😅 ไม่พบร้านที่ตรงตามเงื่อนไข — ลองล้างตัวกรองดูครับ
          </div>
        )}
      </div>

      {filtered.length > limit && (
        <div style={{textAlign:"center", marginTop:"1.25rem"}}>
          <button className="btn btn-ghost" onClick={() => setLimit(l => l + 10)}>
            แสดงเพิ่ม 10 ร้าน (เหลือ {filtered.length - limit})
          </button>
        </div>
      )}

      <p style={{marginTop:"1rem", fontSize:"0.85rem", color:"var(--text-muted)"}}>
        💡 คลิกแถวเพื่อดูรายละเอียด · คลิก 📍 เพื่อเปิด Google Maps · ฟิลเตอร์เพื่อหาร้านที่ตรงใจ
      </p>
    </section>
  );
}

// ============== Top 3 Section ==============
function Top3Section({ onOpen, layout }) {
  const top3 = TOP_RANKED.slice(0, 3);
  const reasonFor = (r, i) => {
    if (!r) return "";
    const s = r.scores;
    const bits = [];
    if (s.rating >= 21) bits.push(`rating ${r.rating}★ จาก ${r.reviewCount.toLocaleString()} รีวิว (ได้ ${s.rating}/25)`);
    if (s.group >= 18) bits.push(`รองรับกลุ่ม 8–12 คนได้สบาย (${s.group}/20)`);
    if (s.travel >= 14) bits.push(`ติด BTS/MRT เดินไม่กี่นาที (${s.travel}/15)`);
    if (s.price >= 13) bits.push(`ราคาสมเหตุสมผล (${s.price}/15)`);
    const lead = i === 0 ? "อันดับ 1 — คะแนนรวมสูงสุด" : i === 1 ? "อันดับ 2" : "อันดับ 3";
    return `${lead} ${s.total}/100 · ${bits.slice(0, 3).join(" · ")} — ${r.notes}`;
  };
  const reasons = {
    [top3[0]?.id]: reasonFor(top3[0], 0),
    [top3[1]?.id]: reasonFor(top3[1], 1),
    [top3[2]?.id]: reasonFor(top3[2], 2)
  };

  return (
    <section className="section" id="top3" data-screen-label="Top 3">
      <div className="section-tag">🥇 Top 3 Recommendation</div>
      <h2 className="section-title">3 ร้านที่เราแนะนำสำหรับทีม</h2>
      <p className="section-subtitle">ตัดสินใจได้ทันทีจาก 3 ตัวเลือกนี้ — มาพร้อมเหตุผล หลักฐาน และเมนูเด่น</p>

      <div className={"top3-grid layout-" + (layout || "grid")}>
        {top3.map((r, i) => (
          <article key={r.id} className="top3-card">
            <div className="top3-score-badge">
              <span className="score-num">{r.scores.total}</span>
              <span className="score-label">/100</span>
            </div>
            <div className="top3-medal">
              {i === 0 ? "🥇 อันดับ 1" : i === 1 ? "🥈 อันดับ 2" : "🥉 อันดับ 3"}
            </div>
            <div className="top3-cover">
              <span className="top3-emoji-big">{r.emoji}</span>
            </div>
            <div className="top3-body">
              <div className="top3-area-badge">📍 {AREAS.find(a => a.id === r.area)?.label}</div>
              <h3 className="top3-name">{r.name}</h3>
              <div className="top3-cuisine">{r.cuisine}</div>

              <div className="top3-stats">
                <div className="top3-stat">
                  <span className="stat-key">Rating</span>
                  <span className="stat-val"><span className="star">★</span> {r.rating} ({r.reviewCount.toLocaleString()})</span>
                </div>
                <div className="top3-stat">
                  <span className="stat-key">ราคา/คน</span>
                  <span className="stat-val">{r.pricePerPerson}</span>
                </div>
                <div className="top3-stat">
                  <span className="stat-key">เดินทาง</span>
                  <span className="stat-val">{r.travel.split("•")[0].trim()}</span>
                </div>
              </div>

              <p className="top3-reason">{reasons[r.id] || r.notes}</p>

              <div className="top3-cta">
                <button className="btn btn-small" onClick={() => onOpen(r)}>🔍 รายละเอียด</button>
                <a className="btn btn-ghost btn-small" href={r.gmapUrl} target="_blank" rel="noopener">
                  📍 ดูร้านนี้
                </a>
                {isDirectSource(r) && (
                  <a className="btn btn-ghost btn-small" href={r.sourceUrl} target="_blank" rel="noopener">
                    🔗 หน้าร้าน
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ============== Comparison Section ==============
function ComparisonSection() {
  const top3 = TOP_RANKED.slice(0, 3);

  const buildProsCons = (r) => {
    const pros = [];
    const cons = [];
    if (r.scores.rating >= 22) pros.push("Rating สูงมาก รีวิวเยอะ น่าเชื่อถือ");
    else if (r.scores.rating <= 18) cons.push("Rating ปานกลาง อาจไม่เหมาะกับทีมที่คาดหวังสูง");
    if (r.scores.group >= 19) pros.push("รับโต๊ะ 8–12 คนได้สบาย/มีห้องส่วนตัว");
    else if (r.scores.group <= 14) cons.push("พื้นที่ค่อนข้างจำกัด ควรจองล่วงหน้า");
    if (r.scores.price >= 14) pros.push("ราคาคุ้มค่า สมเหตุสมผลสำหรับทีม");
    else if (r.scores.price <= 10) cons.push("ราคาสูง อาจเกินงบของบางคน");
    if (r.scores.travel >= 14) pros.push("ติด BTS/MRT เดินทางสะดวกมาก");
    else if (r.scores.travel <= 11) cons.push("ต้องเดินไกลจากสถานี อาจไม่สะดวกตอนฝนตก");
    if (r.scores.uniqueness >= 9) pros.push("ประสบการณ์พิเศษ มี signature dish โดดเด่น");
    if (r.scores.completeness >= 14) pros.push("มีข้อมูลครบทุก field — ตรวจย้อนกลับได้");
    if (pros.length === 0) pros.push("ตัวเลือกที่ปลอดภัย สมดุลในทุกด้าน");
    if (cons.length === 0) cons.push("ช่วงวันหยุดคนเยอะ ควรจองล่วงหน้าให้แน่ใจ");
    return { pros, cons };
  };

  return (
    <section className="section" id="comparison" data-screen-label="Comparison">
      <div className="section-tag">⚖️ Comparison</div>
      <h2 className="section-title">เปรียบเทียบจุดเด่น / ข้อควรระวัง</h2>
      <p className="section-subtitle">ทุกร้านมี trade-off — ตัวเลือกไหนเหมาะกับทีมคุณที่สุด ขึ้นกับสิ่งที่ทีมให้ความสำคัญ</p>

      <div className="compare-grid">
        {top3.map(r => {
          const { pros, cons } = buildProsCons(r);
          return (
            <div className="compare-card" key={r.id}>
              <div className="compare-head">
                <div className="compare-emoji">{r.emoji}</div>
                <div>
                  <div className="compare-name">{r.name}</div>
                  <div className="compare-area">📍 {AREAS.find(a => a.id === r.area)?.label}</div>
                </div>
              </div>

              <div className="compare-label">✨ จุดเด่น (Pros)</div>
              <div className="pros-cons-list">
                {pros.map((p, i) => (
                  <div className="pros-cons-item" key={i}>
                    <span className="pros-icon plus">+</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>

              <div className="compare-label">⚠️ ข้อควรระวัง (Cons)</div>
              <div className="pros-cons-list">
                {cons.map((c, i) => (
                  <div className="pros-cons-item" key={i}>
                    <span className="pros-icon minus">−</span>
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============== Reflection ==============
function ReflectionSection() {
  return (
    <section className="section" id="reflection" data-screen-label="Reflection">
      <div className="section-tag">💭 Reflection</div>
      <h2 className="section-title">สรุปการเรียนรู้</h2>
      <div className="reflection">
        <p style={{lineHeight: 1.75}}>
          งานนี้ทำให้เห็นชัดว่า "การให้ AI ตอบจากความรู้ทั่วไป" กับ "AI ที่ใช้ข้อมูลจริง+เกณฑ์ที่กำหนด"
          ให้ผลลัพธ์ต่างกันมาก ในการเลือกร้านอาหารสำหรับทีม สิ่งที่สำคัญไม่ใช่แค่ rating แต่รวมถึง
          ความเหมาะกับขนาดกลุ่ม การเดินทาง และราคาที่สมเหตุสมผล
        </p>
        <div className="reflection-grid">
          <div className="reflection-item">
            <h5>👍 จุดที่ทำได้ดี</h5>
            <p>Scrape ข้อมูลจริง 108 ร้านจาก 2 แหล่งหลัก (Google Maps + Wongnai) ด้วย Apify ครอบคลุม 5 ย่าน เก็บแยก RAW/CLEAN ในชีทเดียว และให้คะแนน 100 ตามน้ำหนักที่กำหนดอย่างสม่ำเสมอ</p>
          </div>
          <div className="reflection-item">
            <h5>⚠️ จุดที่ติดปัญหา</h5>
            <p>ข้อมูลราคาจากแต่ละแหล่งแสดงคนละแบบ ($$$ vs ฿฿฿) ต้อง normalize ผ่าน Claude ก่อน บางร้านมีคะแนนต่างกันระหว่าง Wongnai กับ Google Maps — ใช้ค่าเฉลี่ย</p>
          </div>
          <div className="reflection-item">
            <h5>🚀 จะปรับปรุงต่อไป</h5>
            <p>เพิ่ม API Google Places เพื่อ rating real-time ทำ scoring แบบ weighted ที่ทีมปรับน้ำหนักได้ และเพิ่ม automation แจ้งร้านใหม่ใน Slack อัตโนมัติทุกสัปดาห์</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============== Top Nav ==============
function Nav({ onToggleTweaks, onToggleDark, isDark }) {
  const links = [
    { href: "#pipeline", label: "Pipeline" },
    { href: "#storage", label: "ข้อมูล" },
    { href: "#scoring", label: "Scoring" },
    { href: "#top10", label: "Top 10" },
    { href: "#top3", label: "Top 3" },
    { href: "#automation", label: "Automation" }
  ];
  return (
    <nav className="nav" data-screen-label="Nav">
      <div className="nav-brand">
        <div className="nav-brand-mark">🍜</div>
        <span>น้าไม่หาร</span>
      </div>
      <div className="nav-links">
        {links.map(l => (
          <a key={l.href} className="nav-link" href={l.href}>{l.label}</a>
        ))}
      </div>
      <div className="nav-controls">
        <button className="icon-btn" onClick={onToggleDark} aria-label="dark mode" title="โหมดมืด">
          {isDark ? "☀️" : "🌙"}
        </button>
        <button className="icon-btn" onClick={onToggleTweaks} aria-label="tweaks" title="Tweaks">✨</button>
      </div>
    </nav>
  );
}

// ============== Root App ==============
function App() {
  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [modal, setModal] = useState(null);

  const setTweak = (k, v) => {
    const next = { ...tweaks, [k]: v };
    setTweaks(next);
    try {
      window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [k]: v } }, "*");
    } catch(e) {}
  };

  // Apply tweaks to root
  useEffect(() => {
    document.documentElement.setAttribute("data-palette", tweaks.palette);
    document.documentElement.setAttribute("data-theme", tweaks.darkMode ? "dark" : "light");
    document.documentElement.style.fontSize = (16 * tweaks.fontScale) + "px";
  }, [tweaks]);

  // Edit mode protocol (Tweaks toolbar toggle)
  useEffect(() => {
    const handler = (e) => {
      if (!e.data) return;
      if (e.data.type === "__activate_edit_mode") setTweaksOpen(true);
      if (e.data.type === "__deactivate_edit_mode") setTweaksOpen(false);
    };
    window.addEventListener("message", handler);
    try { window.parent.postMessage({ type: "__edit_mode_available" }, "*"); } catch(e) {}
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleCloseTweaks = () => {
    setTweaksOpen(false);
    try { window.parent.postMessage({ type: "__edit_mode_dismissed" }, "*"); } catch(e) {}
  };

  const examineeName = "GP : Yellow ไบร์ท";

  return (
    <>
      <Nav
        onToggleTweaks={() => setTweaksOpen(o => !o)}
        onToggleDark={() => setTweak("darkMode", !tweaks.darkMode)}
        isDark={tweaks.darkMode}
      />
      <main>
        <Hero examineeName={examineeName} areas={AREAS} />
        <PipelineSection />
        <StorageSection />
        <ScoringSection />
        <Top10Section onOpen={setModal} />
        <Top3Section onOpen={setModal} layout={tweaks.cardLayout} />
        <ComparisonSection />
        <AutomationSection />
        <ReflectionSection />
      </main>
      <footer>
        <p>🍜 ร้านอาหาร น้าไม่หาร · AI Food Assistant Workflow · จัดทำโดย {examineeName}</p>
        <p style={{marginTop:"0.4rem", fontSize:"0.78rem"}}>
          ข้อมูลร้านจริงจาก Wongnai · Google Maps · Tripadvisor · Grab · Time Out · Ryoii · อัปเดต May 2026
        </p>
      </footer>
      {tweaksOpen && <TweaksPanel tweaks={tweaks} setTweak={setTweak} onClose={handleCloseTweaks} />}
      {modal && <RestaurantModal restaurant={modal} onClose={() => setModal(null)} />}
    </>
  );
}

// รอข้อมูลสดจาก Google Sheet ให้พร้อมก่อน (ถ้ามี) แล้วค่อย mount
// ถ้าไม่มี sheet-loader หรือโหลดไม่ได้ → mount ทันทีด้วยข้อมูล data.js
(window.__dataReady || Promise.resolve()).then(function () {
  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
});
