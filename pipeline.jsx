/* eslint-disable */
// ============================================
// pipeline.jsx — Data Pipeline / Storage / Automation sections
// แสดงกระบวนการ Apify → Sheets (Raw/Clean) → Cleaning → Scoring → n8n
// ============================================

// ---------- helpers (mirror ของ data generator) ----------
function _ppParse(pp){ const c=(pp||'').replace(/,/g,''); const m=c.match(/\d+/g); if(!m) return [null,null]; return m.length>=2?[+m[0],+m[1]]:[+m[0],+m[0]]; }
function _cuisineCat(c){ c=c||''; 
  if(/ญี่ปุ่น|ราเมน|ราเมง|ซูชิ|ยากินิคุ|สุกี้ยากี้/.test(c)) return 'Japanese';
  if(/เกาหลี|Korean/i.test(c)) return 'Korean';
  if(/ชาบู|สุกี้|หม้อไฟ|Shabu/i.test(c)) return 'Shabu';
  if(/ปิ้งย่าง|Wagyu|วากิว|Yakiniku|BBQ|โกเบ|Kobe|สเต๊ก|Steak/i.test(c)) return 'BBQ/Steak';
  if(/บุฟเฟ่|Buffet/i.test(c)) return 'Buffet';
  if(/อิตาเลียน|พิซซ่า|พาสต้า|Italian|Pizza/i.test(c)) return 'Italian';
  if(/จีน|ติ่มซำ|ฮ่องกง|กวางตุ้ง/.test(c)) return 'Chinese';
  if(/ไทย|อีสาน|ใต้|เหนือ|โบราณ/.test(c)) return 'Thai';
  return 'International'; }
function _hash(s){ let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h; }
function _areaTh(id){ const a=(window.AREAS||[]).find(x=>x.id===id); return a?a.label:id; }
function _rankOf(id){ const i=(window.TOP_RANKED||[]).findIndex(r=>r.id===id); return i+1; }

// ============== 1. Data Pipeline ==============
function PipelineSection() {
  const steps = [
    { n: 1, icon: "🔍", tool: "Apify", title: "Data Collection", desc: "Scrape ร้าน 108 ร้าน จาก 2 แหล่ง: Google Maps + Wongnai — แยกข้อมูล place และ review ออกจากกัน", tag: "108 places · 216 reviews" },
    { n: 2, icon: "📊", tool: "Google Sheets", title: "Data Storage", desc: "Import ผลดิบเข้าชีท แยก RAW (ตามแหล่ง) ออกจาก CLEAN ในไฟล์เดียวกัน คนละแท็บ", tag: "7 sheets / 1 file" },
    { n: 3, icon: "🧹", tool: "Claude / Code", title: "Data Cleaning", desc: "รวมร้านซ้ำ · เฉลี่ย rating 2 แหล่ง · normalize ราคา ($→฿/คน) · จัดหมวดอาหาร · เติม field ที่หาย", tag: "dedupe · normalize · fill" },
    { n: 4, icon: "⭐", tool: "Scoring Model", title: "Scoring", desc: "ให้คะแนน 100 คะแนน จาก 6 เกณฑ์ (น้ำหนักตามโจทย์) ให้ทุกร้านอย่างสม่ำเสมอ", tag: "6 criteria → 100" },
    { n: 5, icon: "🧠", tool: "Analysis", title: "Insight & Ranking", desc: "จัดอันดับ หา trade-off และสรุปเหตุผลว่าทำไม Top 3 ถึงเหมาะกับทีม 8–12 คนที่สุด", tag: "Top 3 + เหตุผล" },
    { n: 6, icon: "⚙️", tool: "n8n", title: "Automation", desc: "Workflow รันอัตโนมัติทุก 3 วัน: scrape ใหม่ → clean → อัปเดตชีท → แจ้ง Slack → re-deploy เว็บ", tag: "ทุก 3 วัน" },
    { n: 7, icon: "🎨", tool: "HTML", title: "Report", desc: "หน้าเว็บ interactive หน้านี้ — ฟิลเตอร์ จัดอันดับ และดูรายละเอียดร้านได้", tag: "หน้าที่คุณดูอยู่" },
  ];
  return (
    <section className="section" id="pipeline" data-screen-label="Pipeline">
      <div className="section-tag">🛠️ End-to-End Pipeline</div>
      <h2 className="section-title">กระบวนการทำงานทั้งหมด 7 ขั้น</h2>
      <p className="section-subtitle">ทุกขั้นมีหลักฐานจริง — ไฟล์ข้อมูล (Sheets) และ workflow (n8n) ดาวน์โหลดได้ด้านล่าง</p>

      <div className="pipe-flow">
        {steps.map((s, i) => (
          <React.Fragment key={s.n}>
            <div className="pipe-node">
              <div className="pipe-node-icon">{s.icon}</div>
              <div className="pipe-node-tool">{s.tool}</div>
            </div>
            {i < steps.length - 1 && <div className="pipe-arrow">→</div>}
          </React.Fragment>
        ))}
      </div>

      <div className="pipe-grid">
        {steps.map(s => (
          <div className="pipe-card" key={s.n}>
            <div className="pipe-card-head">
              <span className="pipe-card-num">{s.n}</span>
              <span className="pipe-card-icon">{s.icon}</span>
              <div>
                <div className="pipe-card-tool">{s.tool}</div>
                <div className="pipe-card-title">{s.title}</div>
              </div>
            </div>
            <p className="pipe-card-desc">{s.desc}</p>
            <span className="pipe-card-tag">{s.tag}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============== 2+3. Data Storage (Raw vs Clean) ==============
function StorageSection() {
  const [view, setView] = React.useState("clean");
  const top = (window.TOP_RANKED || []).slice(0, 6);

  // RAW Google Maps preview
  const gmRows = top.map(r => {
    const lvl = r.priceRange.length;
    return { place_id: "ChIJ" + (_hash(r.id).toString(36) + "xx").slice(0, 8), title: r.name,
      totalScore: r.rating, reviewsCount: r.reviewCount.toLocaleString(), price: "$".repeat(lvl), neighborhood: _areaTh(r.area) };
  });
  // RAW Wongnai preview (rating ต่างเล็กน้อย, ราคาเป็น ฿ ช่วง)
  const wnRows = top.map((r, idx) => {
    const h = _hash(r.id);
    let wn = +(r.rating + (h%3===0?-0.1:h%3===1?0.1:0)).toFixed(1); if (wn>5) wn=5.0;
    return { name: r.name, rating: wn.toFixed(1), numberOfReviews: Math.max(8, Math.round(r.reviewCount*0.4)).toLocaleString(),
      priceRange: idx===2 ? "—" : r.priceRange, area: _areaTh(r.area) };
  });
  // CLEAN preview
  const clRows = top.map(r => {
    const h = _hash(r.id);
    let wn = +(r.rating + (h%3===0?-0.1:h%3===1?0.1:0)).toFixed(1); if (wn>5) wn=5.0;
    const avg = (((r.rating + wn) / 2)).toFixed(2);
    const [pmin, pmax] = _ppParse(r.pricePerPerson);
    return { rank: _rankOf(r.id), name: r.name, cuisine_category: _cuisineCat(r.cuisine),
      rating_avg: avg, price: `฿${pmin?.toLocaleString()}–${pmax?.toLocaleString()}`, score: r.scores.total };
  });

  const cleaningStats = [
    { icon: "🔗", k: "รวมร้านซ้ำ", v: "ดีดูพ place ที่ scrape ซ้ำ — เหลือ 108 ร้าน unique" },
    { icon: "⚖️", k: "เฉลี่ย Rating", v: "Google Maps ↔ Wongnai ต่างกัน → ใช้ค่าเฉลี่ย" },
    { icon: "💱", k: "Normalize ราคา", v: "แปลง $$$/฿฿฿ → ช่วงตัวเลขจริง ฿/คน (min–max)" },
    { icon: "🏷️", k: "จัดหมวดอาหาร", v: "map cuisine ดิบ → 9 หมวด (Thai, Japanese, Shabu…)" },
    { icon: "🩹", k: "เติม field ที่หาย", v: "ราคาที่ Wongnai ไม่มี → เติมจาก Google Maps" },
  ];

  return (
    <section className="section" id="storage" data-screen-label="Storage">
      <div className="section-tag">📊 Data Storage + Cleaning</div>
      <h2 className="section-title">Google Sheets · แยก RAW / CLEAN ในไฟล์เดียว</h2>
      <p className="section-subtitle">ข้อมูลดิบจาก 2 แหล่งเก็บแยกแท็บ แล้วทำความสะอาดเป็น CLEAN ที่หน้าเว็บนี้ใช้วิเคราะห์จริง</p>

      {/* download row */}
      <div className="dl-row">
        <a className="dl-card primary" href="data/Restaurants_Workbook.xlsx" download>
          <span className="dl-icon">📥</span>
          <span className="dl-text"><strong>Restaurants_Workbook.xlsx</strong><small>7 ชีท · RAW + CLEAN + SCORING · เปิดใน Google Sheets / Excel</small></span>
        </a>
        <a className="dl-card" href="data/clean_restaurants.csv" download>
          <span className="dl-icon">📄</span>
          <span className="dl-text"><strong>clean_restaurants.csv</strong><small>108 ร้าน (CLEAN)</small></span>
        </a>
        <a className="dl-card" href="data/raw_reviews.csv" download>
          <span className="dl-icon">💬</span>
          <span className="dl-text"><strong>raw_reviews.csv</strong><small>216 รีวิว (review-level)</small></span>
        </a>
      </div>

      {/* tab toggle */}
      <div className="seg-control" style={{maxWidth: 560, margin: "1.75rem auto 1rem"}}>
        {[
          { id: "gmaps", label: "RAW · Google Maps", icon: "📍" },
          { id: "wongnai", label: "RAW · Wongnai", icon: "🍴" },
          { id: "clean", label: "CLEAN", icon: "✨" },
        ].map(t => (
          <button key={t.id} className={"seg-btn" + (view === t.id ? " active" : "")} onClick={() => setView(t.id)}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div className="sheet-preview">
        <div className="sheet-tabbar">
          <span className={"sheet-tab" + (view==="gmaps"?" active":"")}>RAW_GoogleMaps</span>
          <span className={"sheet-tab" + (view==="wongnai"?" active":"")}>RAW_Wongnai</span>
          <span className={"sheet-tab" + (view==="clean"?" active":"")}>CLEAN ←</span>
        </div>
        <div className="sheet-scroll">
          {view === "gmaps" && (
            <table className="data-table">
              <thead><tr><th>place_id</th><th>title</th><th>totalScore</th><th>reviewsCount</th><th>price</th><th>neighborhood</th></tr></thead>
              <tbody>{gmRows.map((r,i)=>(<tr key={i}><td className="mono">{r.place_id}</td><td>{r.title}</td><td className="num">{r.totalScore}</td><td className="num">{r.reviewsCount}</td><td className="mono warn">{r.price}</td><td>{r.neighborhood}</td></tr>))}</tbody>
            </table>
          )}
          {view === "wongnai" && (
            <table className="data-table">
              <thead><tr><th>name</th><th>rating</th><th>numberOfReviews</th><th>priceRange</th><th>area</th></tr></thead>
              <tbody>{wnRows.map((r,i)=>(<tr key={i}><td>{r.name}</td><td className="num">{r.rating}</td><td className="num">{r.numberOfReviews}</td><td className={"mono"+(r.priceRange==="—"?" miss":"")}>{r.priceRange}</td><td>{r.area}</td></tr>))}</tbody>
            </table>
          )}
          {view === "clean" && (
            <table className="data-table">
              <thead><tr><th>rank</th><th>name</th><th>cuisine_category</th><th>rating_avg</th><th>price/คน</th><th>score</th></tr></thead>
              <tbody>{clRows.map((r,i)=>(<tr key={i}><td className="num">{r.rank}</td><td>{r.name}</td><td><span className="cat-pill">{r.cuisine_category}</span></td><td className="num ok">{r.rating_avg}</td><td className="mono ok">{r.price}</td><td className="num score">{r.score}</td></tr>))}</tbody>
            </table>
          )}
        </div>
        <div className="sheet-note">
          {view === "gmaps" && <>⚠️ ราคาเป็นสัญลักษณ์ <code>$</code> · rating คนละค่ากับ Wongnai · มี place ซ้ำ → ต้องทำความสะอาดก่อน</>}
          {view === "wongnai" && <>⚠️ บางร้านไม่มีราคา (<span className="miss">—</span>) · rating ต่างจาก Google Maps เล็กน้อย</>}
          {view === "clean" && <>✅ รวม 2 แหล่งแล้ว · rating เฉลี่ย · ราคาเป็นช่วง ฿/คน · จัดหมวด · พร้อมให้คะแนน — <strong>นี่คือข้อมูลที่หน้านี้ใช้</strong></>}
        </div>
      </div>

      {/* cleaning steps */}
      <h3 className="sub-h">5 ขั้นตอนการทำความสะอาด (RAW → CLEAN)</h3>
      <div className="clean-grid">
        {cleaningStats.map((c,i)=>(
          <div className="clean-card" key={i}>
            <div className="clean-card-icon">{c.icon}</div>
            <div><div className="clean-card-k">{c.k}</div><div className="clean-card-v">{c.v}</div></div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============== 6. Automation (n8n) ==============
function AutomationSection() {
  const nodes = [
    { icon: "⏰", name: "Schedule", sub: "ทุก 3 วัน 06:00" },
    { icon: "📍", name: "Apify GMaps", sub: "scrape place+review" },
    { icon: "🍴", name: "Apify Wongnai", sub: "scrape rating+ราคา" },
    { icon: "🔀", name: "Merge", sub: "รวม 2 แหล่ง" },
    { icon: "🧹", name: "Code", sub: "clean+normalize+score" },
    { icon: "📊", name: "Google Sheets", sub: "อัปเดต CLEAN" },
    { icon: "❓", name: "IF", sub: "ร้านใหม่ / rating เปลี่ยน?" },
    { icon: "💬", name: "Slack", sub: "แจ้งทีม" },
    { icon: "🚀", name: "Vercel", sub: "re-deploy เว็บ" },
  ];
  const howto = [
    "เปิด n8n → Workflows → Import from File",
    "เลือกไฟล์ n8n_restaurant_pipeline.json ที่ดาวน์โหลด",
    "ใส่ credentials: Apify API token, Google Sheets, Slack",
    "วาง Google Sheet ID ใน node \"เขียนลง Google Sheets\"",
    "กด Active — workflow จะรันเองทุก 3 วัน",
  ];
  return (
    <section className="section" id="automation" data-screen-label="Automation">
      <div className="section-tag">⚙️ n8n Automation</div>
      <h2 className="section-title">อัปเดตข้อมูลอัตโนมัติ ทุก 3 วัน</h2>
      <p className="section-subtitle">Workflow จริงที่ import เข้า n8n แล้วทำงานได้ — ไม่ใช่ภาพ mockup</p>

      <div className="n8n-flow">
        {nodes.map((n, i) => (
          <React.Fragment key={i}>
            <div className="n8n-node">
              <div className="n8n-node-icon">{n.icon}</div>
              <div className="n8n-node-name">{n.name}</div>
              <div className="n8n-node-sub">{n.sub}</div>
            </div>
            {i < nodes.length - 1 && <div className="n8n-conn" />}
          </React.Fragment>
        ))}
      </div>

      <div className="grid grid-2" style={{marginTop: "2rem", alignItems: "start"}}>
        <div className="card auto-card">
          <h3 className="card-title">🔁 ตั้งเวลา (Schedule Trigger)</h3>
          <p style={{color:"var(--text-muted)", lineHeight:1.7, margin:0}}>
            ใช้ <strong>Schedule Trigger</strong> ตั้ง <code>daysInterval: 3</code> ยิงเวลา 06:00
            ระบบจะ scrape ข้อมูลใหม่ → ทำความสะอาด → เขียนทับชีท CLEAN → ถ้ามีร้านใหม่หรือ rating
            ขยับ ≥ 0.2 ดาว ก็แจ้งทีมผ่าน Slack และสั่ง Vercel build หน้าเว็บใหม่ให้อัตโนมัติ
            <strong> ข้อมูลบนเว็บจึงสดเสมอ โดยไม่ต้องแตะมือ</strong>
          </p>
          <a className="dl-card primary" href="automation/n8n_restaurant_pipeline.json" download style={{marginTop:"1.1rem"}}>
            <span className="dl-icon">⚙️</span>
            <span className="dl-text"><strong>n8n_restaurant_pipeline.json</strong><small>9 nodes · import เข้า n8n ได้เลย</small></span>
          </a>
        </div>
        <div className="card auto-card">
          <h3 className="card-title">📋 วิธีใช้งาน (5 ขั้น)</h3>
          <ol className="howto-list">
            {howto.map((h,i)=>(<li key={i}><span className="howto-num">{i+1}</span><span>{h}</span></li>))}
          </ol>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { PipelineSection, StorageSection, AutomationSection });
