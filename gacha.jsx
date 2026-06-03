/* eslint-disable */
// ============================================
// gacha.jsx — 🎰 น้าไม่หาร สุ่มให้! (Restaurant Gacha)
// เลือกไม่ได้ก็สุ่มซะ — สุ่มแบบถ่วงน้ำหนักด้วยคะแนน + เคารพตัวกรอง
// ไม่ยุ่งกับหลังบ้าน: อ่านจาก window.RESTAURANTS ที่โหลดไว้แล้ว
// ============================================

const { useState, useEffect, useMemo, useRef } = React;

// สุ่มแบบถ่วงน้ำหนัก: ร้านคะแนนสูง = โอกาสออกมากกว่า แต่ร้านรองยังมีลุ้น
function gachaWeightedPick(pool) {
  if (!pool.length) return null;
  const weights = pool.map(r => Math.pow(Math.max(1, (r.scores.total - 50)), 2.1));
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = Math.random() * sum;
  for (let i = 0; i < pool.length; i++) {
    t -= weights[i];
    if (t <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// เหตุผลสั้นๆ ว่าทำไมร้านนี้น่าไป — หยิบหมวดที่ทำคะแนนได้ดีที่สุด
function gachaReason(r) {
  const crit = window.SCORING_CRITERIA || [];
  let best = null, bestPct = -1;
  for (const c of crit) {
    const v = r.scores[c.id];
    if (v == null) continue;
    const pct = v / c.weight;
    if (pct > bestPct) { bestPct = pct; best = c; }
  }
  const map = {
    rating: `รีวิวแน่น ${r.rating}★ จาก ${r.reviewCount.toLocaleString()} รีวิว`,
    group: "รองรับโต๊ะใหญ่ 8–12 คนสบายๆ",
    price: `ราคาคุ้ม ${r.pricePerPerson}`,
    travel: "เดินทางสะดวก ติดรถไฟฟ้า",
    uniqueness: "มีเมนู/บรรยากาศเด่นไม่เหมือนใคร",
    completeness: "ข้อมูลครบ ตรวจสอบย้อนกลับได้",
  };
  return best ? (map[best.id] || "ตัวเลือกที่สมดุลในทุกด้าน") : "ตัวเลือกที่สมดุลในทุกด้าน";
}

function gachaAreaOf(areaId) {
  return (window.AREAS || []).find(a => a.id === areaId) || null;
}

// ---------- ปุ่มลอย ----------
function GachaFab({ onClick }) {
  return (
    <button className="gacha-fab" onClick={onClick} aria-label="สุ่มร้านอาหาร">
      <span className="gacha-fab-emoji">🎰</span>
      <span className="gacha-fab-text">สุ่มร้านให้หน่อย!</span>
    </button>
  );
}

// ---------- การ์ดในรีล ----------
function GachaCell({ r }) {
  const area = gachaAreaOf(r.area);
  return (
    <div className="gacha-cell">
      <span className="gacha-cell-emoji">{r.emoji}</span>
      <div className="gacha-cell-info">
        <div className="gacha-cell-name">{r.name}</div>
        <div className="gacha-cell-meta">
          {area ? `${area.emoji} ${area.label}` : ""} · {r.pricePerPerson}
        </div>
      </div>
      <span className="gacha-cell-score">{r.scores.total}</span>
    </div>
  );
}

// ---------- เครื่องกาชาหลัก ----------
function GachaMachine({ onOpen }) {
  const [open, setOpen] = useState(false);
  const [area, setArea] = useState("all");
  const [cuisine, setCuisine] = useState("all");
  const [format, setFormat] = useState("all"); // all | buffet | alacarte
  const [phase, setPhase] = useState("idle");   // idle | spinning | result
  const [winner, setWinner] = useState(null);
  const [reel, setReel] = useState([]);
  const stripRef = useRef(null);

  const ALL = window.RESTAURANTS || [];
  const AREAS = window.AREAS || [];
  const CUISINES = window.CUISINE_CATEGORIES || [];
  const getCuisine = window.getCuisineCategoryId || (() => "all");
  const isBuffetFn = window.isBuffet || (() => false);

  // ซ่อนประเภทอาหารที่ไม่มีร้านเลย (กันชิปว่างรก)
  const cuisinesShown = useMemo(() => {
    const cnt = {};
    (ALL || []).forEach(r => { const k = getCuisine(r); cnt[k] = (cnt[k] || 0) + 1; });
    return CUISINES.filter(c => c.id === "all" || cnt[c.id] > 0);
  }, [ALL]);

  const CELL_H = 92;

  const pool = useMemo(() => {
    let list = ALL.slice();
    if (area !== "all") list = list.filter(r => r.area === area);
    if (cuisine !== "all") list = list.filter(r => getCuisine(r) === cuisine);
    if (format === "buffet") list = list.filter(r => isBuffetFn(r));
    if (format === "alacarte") list = list.filter(r => !isBuffetFn(r));
    return list;
  }, [area, cuisine, format]);

  // เปลี่ยนตัวกรองตอนโชว์ผล → กลับไปหน้าตั้งค่า
  useEffect(() => { if (phase === "result") setPhase("idle"); }, [area, cuisine, format]);

  const spin = () => {
    if (!pool.length || phase === "spinning") return;
    const w = gachaWeightedPick(pool);
    // สร้างรีล: ช่องสุ่ม ~32 ช่อง + ผู้ชนะปิดท้าย
    const cells = [];
    for (let i = 0; i < 32; i++) cells.push(pool[Math.floor(Math.random() * pool.length)]);
    cells.push(w);
    setReel(cells);
    setWinner(w);
    setPhase("spinning");
  };

  // ขับเคลื่อนแอนิเมชันรีล
  useEffect(() => {
    if (phase !== "spinning" || !stripRef.current || !reel.length) return;
    const strip = stripRef.current;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = reduce ? 0.4 : 2.5;
    strip.style.transition = "none";
    strip.style.transform = "translateY(0px)";
    void strip.offsetHeight; // reflow
    requestAnimationFrame(() => {
      strip.style.transition = `transform ${dur}s cubic-bezier(0.10, 0.82, 0.16, 1)`;
      strip.style.transform = `translateY(-${(reel.length - 1) * CELL_H}px)`;
    });
    const t = setTimeout(() => setPhase("result"), dur * 1000 + 120);
    return () => clearTimeout(t);
  }, [phase, reel]);

  const close = () => { setOpen(false); };
  const openDetail = (r) => { setOpen(false); onOpen && onOpen(r); };

  // ESC + ล็อกสกอลล์เมื่อเปิด
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => e.key === "Escape" && close();
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [open]);

  const winnerArea = winner ? gachaAreaOf(winner.area) : null;

  return (
    <>
      <GachaFab onClick={() => { setPhase("idle"); setOpen(true); }} />

      {open && (
        <div className="gacha-backdrop" onClick={close}>
          <div className="gacha-modal" onClick={(e) => e.stopPropagation()} data-screen-label="Gacha">
            <button className="gacha-close" onClick={close} aria-label="ปิด">✕</button>

            <div className="gacha-head">
              <div className="gacha-kicker">🎰 เลือกไม่ได้ ให้น้าช่วย</div>
              <h3 className="gacha-title">สุ่มร้านอาหารให้ทีม</h3>
              <p className="gacha-sub">
                สุ่มจากร้านในระบบ — <strong>ถ่วงน้ำหนักด้วยคะแนน</strong> ร้านดีโอกาสออกเยอะกว่า แต่ทุกร้านมีลุ้น
              </p>
            </div>

            {/* ตัวกรอง */}
            <div className="gacha-filters">
              <div className="gacha-filter-group">
                <span className="gacha-filter-label">📍 ย่าน</span>
                <div className="gacha-chips">
                  <button className={"gacha-chip" + (area === "all" ? " on" : "")} onClick={() => setArea("all")}>ทั้งหมด</button>
                  {AREAS.map(a => (
                    <button key={a.id} className={"gacha-chip" + (area === a.id ? " on" : "")} onClick={() => setArea(a.id)}>
                      {a.emoji} {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="gacha-filter-group">
                <span className="gacha-filter-label">🍴 ประเภท</span>
                <div className="gacha-chips">
                  {cuisinesShown.map(c => (
                    <button key={c.id} className={"gacha-chip" + (cuisine === c.id ? " on" : "")} onClick={() => setCuisine(c.id)}>
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="gacha-filter-group">
                <span className="gacha-filter-label">🍽️ รูปแบบ</span>
                <div className="gacha-chips">
                  <button className={"gacha-chip" + (format === "all" ? " on" : "")} onClick={() => setFormat("all")}>ทั้งหมด</button>
                  <button className={"gacha-chip" + (format === "buffet" ? " on" : "")} onClick={() => setFormat("buffet")}>♾️ บุฟเฟ่ต์</button>
                  <button className={"gacha-chip" + (format === "alacarte" ? " on" : "")} onClick={() => setFormat("alacarte")}>🍱 A La Carte</button>
                </div>
              </div>
            </div>

            {/* เครื่องสุ่ม */}
            <div className="gacha-stage">
              <div className="gacha-window">
                <div className="gacha-window-marker" />
                {phase === "idle" && (
                  <div className="gacha-idle">
                    <span className="gacha-idle-emoji">🍜</span>
                    <span className="gacha-idle-text">
                      {pool.length > 0
                        ? `พร้อมสุ่มจาก ${pool.length} ร้าน`
                        : "ไม่มีร้านตรงเงื่อนไขนี้ ลองปรับตัวกรอง"}
                    </span>
                  </div>
                )}
                {(phase === "spinning" || phase === "result") && (
                  <div className="gacha-strip" ref={stripRef}>
                    {reel.map((r, i) => <GachaCell key={i} r={r} />)}
                  </div>
                )}
              </div>
            </div>

            {/* ผลลัพธ์ */}
            {phase === "result" && winner && (
              <div className="gacha-result">
                <div className="gacha-result-confetti">🎉</div>
                <div className="gacha-result-head">
                  <span className="gacha-result-emoji">{winner.emoji}</span>
                  <div className="gacha-result-info">
                    <div className="gacha-result-badge">
                      {winnerArea ? `${winnerArea.emoji} ${winnerArea.label}` : ""}
                      <span className="gacha-result-score">★ {winner.scores.total}/100</span>
                    </div>
                    <div className="gacha-result-name">{winner.name}</div>
                    <div className="gacha-result-cuisine">{winner.cuisine}</div>
                  </div>
                </div>
                <div className="gacha-result-reason">
                  <span className="gacha-result-reason-key">ทำไมน้าเลือกร้านนี้</span>
                  {gachaReason(winner)}
                </div>
                <div className="gacha-result-stats">
                  <div className="gacha-rs"><span className="k">Rating</span><span className="v">★ {winner.rating}</span></div>
                  <div className="gacha-rs"><span className="k">ราคา/คน</span><span className="v">{winner.pricePerPerson}</span></div>
                  <div className="gacha-rs"><span className="k">เดินทาง</span><span className="v">{winner.travel}</span></div>
                </div>
              </div>
            )}

            {/* ปุ่มสั่งงาน */}
            <div className="gacha-actions">
              {phase !== "result" && (
                <button className="gacha-spin-btn" onClick={spin} disabled={!pool.length || phase === "spinning"}>
                  {phase === "spinning" ? "กำลังสุ่ม…" : `🎲 หมุนเลย! (${pool.length} ร้าน)`}
                </button>
              )}
              {phase === "result" && winner && (
                <>
                  <button className="gacha-spin-btn ghost" onClick={spin}>🎲 สุ่มใหม่</button>
                  <a className="gacha-spin-btn ghost" href={winner.gmapUrl} target="_blank" rel="noopener">📍 Maps</a>
                  <button className="gacha-spin-btn" onClick={() => openDetail(winner)}>ดูรายละเอียด →</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

window.GachaMachine = GachaMachine;
