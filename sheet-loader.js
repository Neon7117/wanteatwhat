/* ============================================================
   sheet-loader.js — ดึงข้อมูลร้านสดจาก Google Sheets (แท็บ CLEAN)
   ------------------------------------------------------------
   ทำงาน: โหลด CSV ที่ publish จาก Google Sheet → แปลงเป็น window.RESTAURANTS
   ถ้าโหลด/แปลงไม่สำเร็จ → คงข้อมูลเดิมจาก data.js ไว้ (fallback, ไม่มีจอขาว)

   วิธีเปลี่ยน Sheet: แก้ค่า SHEET_CSV_URL ด้านล่างให้เป็นลิงก์
   "File → Share → Publish to web → แท็บ CLEAN → CSV" ของชีตคุณ
   ============================================================ */
(function () {
  // ===== ตั้งค่า: ลิงก์ Publish-to-web (CSV) ของแท็บ CLEAN =====
  var SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQr7YjqwOfngpAKDoijDUdi-vzJetZy3VlTPcuOPKxwfiTCFWaBAKjDL26vHMiYVf1PsWsUD7obyxMq/pub?gid=1488289448&single=true&output=csv";

  window.__dataSource = "fallback"; // จะถูกตั้งเป็น "sheet" เมื่อโหลดสำเร็จ

  // ---------- CSV parser (รองรับ field มี comma / quote / ขึ้นบรรทัด) ----------
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else { field += c; }
      } else {
        if (c === '"') { inQuotes = true; }
        else if (c === ",") { row.push(field); field = ""; }
        else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
        else if (c === "\r") { /* ข้าม */ }
        else { field += c; }
      }
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  // ---------- แปลงตาราง → array ของ restaurant object (จับคู่ด้วยชื่อหัวคอลัมน์) ----------
  function rowsToRestaurants(rows) {
    if (!rows || rows.length < 2) return null;
    var header = rows[0].map(function (h) { return (h || "").trim(); });
    var idx = {};
    header.forEach(function (h, i) { idx[h] = i; });
    // ต้องมีคอลัมน์หลักเหล่านี้อย่างน้อย
    var required = ["id", "name", "area", "rating"];
    for (var k = 0; k < required.length; k++) {
      if (!(required[k] in idx)) {
        console.warn("[sheet-loader] ขาดคอลัมน์จำเป็น: " + required[k] + " — ใช้ข้อมูล fallback");
        return null;
      }
    }
    var get = function (r, key) {
      return key in idx ? (r[idx[key]] !== undefined ? r[idx[key]] : "") : "";
    };
    var num = function (v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; };

    var out = [];
    for (var rI = 1; rI < rows.length; rI++) {
      var r = rows[rI];
      if (!r || !get(r, "id")) continue; // ข้ามแถวว่าง
      // คะแนนย่อย 6 เกณฑ์
      var sR = num(get(r, "score_rating"));
      var sG = num(get(r, "score_group"));
      var sP = num(get(r, "score_price"));
      var sT = num(get(r, "score_travel"));
      var sC = num(get(r, "score_completeness"));
      var sU = num(get(r, "score_uniqueness"));
      var sixSum = sR + sG + sP + sT + sC + sU;
      var totalCol = num(get(r, "score_total"));
      var total = sixSum > 0 ? sixSum : totalCol; // ถ้าแก้คะแนนย่อยในชีต total อัปเดตตาม

      // gmapReview (เก็บเป็น JSON ในคอลัมน์เดียว)
      var gmapReview = null;
      var grj = get(r, "gmapReviewJson");
      if (grj) { try { gmapReview = JSON.parse(grj); } catch (e) { gmapReview = null; } }

      // signature คั่นด้วย " | "
      var sig = get(r, "signature");
      var signature = sig ? sig.split("|").map(function (s) { return s.trim(); }).filter(Boolean) : [];

      out.push({
        id: get(r, "id"),
        name: get(r, "name"),
        nameEn: get(r, "nameEn") || get(r, "name"),
        area: get(r, "area"),
        cuisine: get(r, "cuisine"),
        rating: num(get(r, "rating")),
        reviewCount: parseInt(get(r, "reviewCount"), 10) || 0,
        priceRange: get(r, "priceRange"),
        pricePerPerson: get(r, "pricePerPerson"),
        address: get(r, "address"),
        travel: get(r, "travel"),
        hours: get(r, "hours"),
        groupFriendly: get(r, "groupFriendly"),
        source: get(r, "source"),
        sourceUrl: get(r, "sourceUrl"),
        notes: get(r, "notes"),
        signature: signature,
        emoji: get(r, "emoji") || "🍽️",
        gmapUrl: get(r, "gmapUrl"),
        gmapReview: gmapReview,
        scores: {
          rating: sR, group: sG, price: sP, travel: sT,
          completeness: sC, uniqueness: sU, total: total
        }
      });
    }
    return out.length ? out : null;
  }

  // ---------- ตัวโหลดหลัก ----------
  window.__dataReady = (function () {
    if (!SHEET_CSV_URL || SHEET_CSV_URL.indexOf("PASTE_") !== -1) {
      console.log("[sheet-loader] ยังไม่ได้ตั้ง SHEET_CSV_URL — ใช้ข้อมูลใน data.js");
      return Promise.resolve(false);
    }
    var url = SHEET_CSV_URL + (SHEET_CSV_URL.indexOf("?") === -1 ? "?" : "&") + "_cb=" + Date.now();
    return fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var list = rowsToRestaurants(parseCSV(text));
        if (!list) throw new Error("แปลงข้อมูลไม่สำเร็จ");
        window.RESTAURANTS = list;
        window.TOP_RANKED = list.slice().sort(function (a, b) {
          return b.scores.total - a.scores.total;
        });
        window.__dataSource = "sheet";
        console.log("[sheet-loader] ✅ โหลดจาก Google Sheet สำเร็จ: " + list.length + " ร้าน");
        return true;
      })
      .catch(function (err) {
        console.warn("[sheet-loader] ⚠️ โหลด Sheet ไม่สำเร็จ (" + err.message + ") — ใช้ข้อมูล data.js แทน");
        window.__dataSource = "fallback";
        return false;
      });
  })();
})();
