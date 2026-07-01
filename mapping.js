// ===== 新增 OCR 功能開始 (mapping.js) =====
// 用途：把 OCR 辨識出的原始文字，依「中文名稱 → 網站欄位 ID」規則解析成可填入表單的資料。
//
// 設計原則：
//   1. 先用「章節標題」把整段 OCR 文字切開，避免像「住院手術」這種在不同章節重複出現的
//      名稱互相干擾（定額給付醫療 vs 實支實付醫療都有「住院手術」）。
//   2. 每個章節內部才用關鍵字比對抓數值，關鍵字需全部符合（AND）才算命中。
//   3. 單位換算規則統一寫在 UNIT，不要散落在各處，之後要調整換算方式只改一處。
//   4. 數值為 0 或抓不到的欄位，一律不回填（維持欄位空白），避免產生「0萬」這種奇怪卡片。
//
// 已依使用者確認的規則：
//   - 定額給付醫療「住院手術」與「住院手術看護」→ 合併成一個範圍，填入 daily-op-min / daily-op-max
//   - 癌症「化學醫療」與「放射線醫療」→ 共用 cancer-chemo 欄位，取兩者中較大值
//   - 萬元換算 → 四捨五入到小數點後 2 位
//   - 其餘保單圖片項目（意外失能範圍、住院手術看護單獨欄位、門診手術、初次罹癌保險金、
//     特定傷病、失能扶助等）在網站上沒有對應欄位，一律略過不處理

(function (global) {

  // ---- 章節定義：依保單圖片版面上的標題文字，用來切割整段 OCR 文字 ----
  const SECTIONS = [
    { id: 'life',      markers: ['壽險保障'] },
    { id: 'accident',  markers: ['意外保障'] },
    { id: 'retire',    markers: ['養老保障'] },
    { id: 'longcare',  markers: ['長照保障'] },
    { id: 'med_fixed', markers: ['定額給付醫療'] },
    { id: 'med_reimb', markers: ['實支實付醫療'] },
    { id: 'cancer',    markers: ['癌症醫療'] },
    { id: 'critical',  markers: ['重大疾病與重大傷病保障', '重大疾病與重大傷病'] },
  ];

  // ---- 單位換算（依使用者確認：萬元四捨五入到小數2位，整數不留小數） ----
  const UNIT = {
    // 元 → 萬
    wan(v) {
      const n = Math.round((v / 10000) * 100) / 100;
      if (Number.isInteger(n)) return String(n);
      return String(n.toFixed(2)).replace(/0+$/, '').replace(/\.$/, '');
    },
    // 元 → 百元（網站以百元為輸入單位的欄位，如住院日額系列）
    bai(v) {
      return String(Math.round(v / 100));
    },
    // 原始元，加千分位逗號（符合網站既有欄位格式，如 3,000）
    raw(v) {
      return Math.round(v).toLocaleString('en-US');
    },
  };

  function parseNum(str) {
    if (!str) return null;
    const cleaned = String(str).replace(/[,，元\s]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }

  // 在文字中找「單一數值」，例如「1,200,000元」
  function findSingleValue(text, keywords, excludeKeywords) {
    for (const line of text.split('\n')) {
      if (!keywords.every((k) => line.includes(k))) continue;
      if (excludeKeywords && excludeKeywords.some((k) => line.includes(k))) continue;
      const m = line.match(/([\d,]+(?:\.\d+)?)\s*元/);
      if (m) {
        const n = parseNum(m[1]);
        if (n !== null) return n;
      }
    }
    return null;
  }

  // 在文字中找「範圍值」，例如「2,200~240,000元」
  function findRangeValue(text, keywords, excludeKeywords) {
    for (const line of text.split('\n')) {
      if (!keywords.every((k) => line.includes(k))) continue;
      if (excludeKeywords && excludeKeywords.some((k) => line.includes(k))) continue;
      const m = line.match(/([\d,]+(?:\.\d+)?)\s*[~〜～\-]\s*([\d,]+(?:\.\d+)?)\s*元/);
      if (m) {
        const min = parseNum(m[1]), max = parseNum(m[2]);
        if (min !== null && max !== null) return { min, max };
      }
      const single = line.match(/([\d,]+(?:\.\d+)?)\s*元/);
      if (single) {
        const n = parseNum(single[1]);
        if (n !== null) return { min: n, max: n };
      }
    }
    return null;
  }

  // 把整段 OCR 文字依章節標題切開
  function splitBySections(rawText) {
    const positions = [];
    SECTIONS.forEach((sec) => {
      sec.markers.forEach((marker) => {
        const idx = rawText.indexOf(marker);
        if (idx !== -1) positions.push({ id: sec.id, idx });
      });
    });
    positions.sort((a, b) => a.idx - b.idx);
    const chunks = {};
    for (let i = 0; i < positions.length; i++) {
      const start = positions[i].idx;
      const end = i + 1 < positions.length ? positions[i + 1].idx : rawText.length;
      const id = positions[i].id;
      chunks[id] = (chunks[id] || '') + rawText.slice(start, end) + '\n';
    }
    return chunks;
  }

  // ---- 主要對應表：章節 + 關鍵字 + 欄位 ID + 換算方式 ----
  // type: 'single' = 抓一個數值 / 'range' = 抓一個範圍（自動拆成 -min / -max 兩個欄位）
  const FIELD_RULES = [
    { section: 'life',      keywords: ['壽險身故保障'],   fieldId: 'life-amount',     type: 'single', unit: 'wan' },

    { section: 'accident',  keywords: ['意外身故或完全失能'], fieldId: 'acc-death',   type: 'single', unit: 'wan' },
    { section: 'accident',  keywords: ['意外醫療限額'],       fieldId: 'acc-reimb',   type: 'single', unit: 'wan' },
    { section: 'accident',  keywords: ['意外住院'],           fieldId: 'acc-daily',   type: 'single', unit: 'bai' },

    { section: 'med_fixed', keywords: ['住院日額'],           fieldId: 'daily-hosp',  type: 'single', unit: 'bai' },
    { section: 'med_fixed', keywords: ['住院看護'],           fieldId: 'daily-nurse', type: 'single', unit: 'bai' },
    { section: 'med_fixed', keywords: ['出院後療養日額'],     fieldId: 'daily-post',  type: 'single', unit: 'bai' },
    // 註：med_fixed 的「住院手術」有合併規則，見下方 mergeDailyOpRange()，不在此列表處理

    { section: 'med_reimb', keywords: ['每日病房費用限額'],   fieldId: 'reimb-room',  type: 'single', unit: 'raw' },
    { section: 'med_reimb', keywords: ['住院醫療限額'],       fieldId: 'reimb-misc',  type: 'single', unit: 'raw' },
    { section: 'med_reimb', keywords: ['住院手術'],           fieldId: 'reimb-op',    type: 'range',  unit: 'raw' },

    { section: 'cancer',    keywords: ['癌症住院醫療'],       fieldId: 'cancer-hosp',     type: 'single', unit: 'bai' },
    { section: 'cancer',    keywords: ['癌症出院後療養'],     fieldId: 'cancer-post',     type: 'single', unit: 'bai' },
    { section: 'cancer',    keywords: ['癌症住院手術'],       fieldId: 'cancer-op',       type: 'single', unit: 'wan' },
    { section: 'cancer',    keywords: ['癌症安養'],           fieldId: 'cancer-care-amt', type: 'single', unit: 'wan' },
    // 註：cancer 的「化學醫療 / 放射線醫療」有合併規則，見下方 mergeCancerChemo()

    { section: 'critical',  keywords: ['重大傷病'], excludeKeywords: ['與重大傷病保障'], fieldId: 'critical-amount', type: 'single', unit: 'wan' },
    { section: 'critical',  keywords: ['重大疾病'], excludeKeywords: ['與重大傷病保障'], fieldId: 'disease-amount',  type: 'single', unit: 'wan' },

    { section: 'longcare',  keywords: ['長期照顧', '一次性'], fieldId: 'longcare-lump',    type: 'single', unit: 'wan' },
    { section: 'longcare',  keywords: ['長期照顧', '月給付'], fieldId: 'longcare-monthly', type: 'single', unit: 'wan' },
  ];

  // ---- 特殊合併規則一：定額給付醫療「住院手術」＋「住院手術看護」→ 合併範圍 ----
  function mergeDailyOpRange(chunk) {
    const opRange    = findRangeValue(chunk, ['住院手術'], ['看護']);
    const nurseRange = findRangeValue(chunk, ['住院手術', '看護']);
    if (!opRange && !nurseRange) return null;
    const ranges = [opRange, nurseRange].filter(Boolean);
    return {
      min: Math.min(...ranges.map((r) => r.min)),
      max: Math.max(...ranges.map((r) => r.max)),
    };
  }

  // ---- 特殊合併規則二：癌症「化學醫療」＋「放射線醫療」共用一個欄位，取較大值 ----
  function mergeCancerChemo(chunk) {
    const chemo = findSingleValue(chunk, ['癌症化學醫療']);
    const radio = findSingleValue(chunk, ['癌症放射線醫療']);
    const values = [chemo, radio].filter((v) => v !== null);
    if (!values.length) return null;
    return Math.max(...values);
  }

  // ---- 主函式：輸入 OCR 原始文字，輸出 { 欄位ID: 顯示用字串 } ----
  function extractFieldsFromOcrText(rawText) {
    const result = {};
    const chunks = splitBySections(rawText || '');

    FIELD_RULES.forEach((rule) => {
      const chunk = chunks[rule.section];
      if (!chunk) return;

      if (rule.type === 'single') {
        const raw = findSingleValue(chunk, rule.keywords, rule.excludeKeywords);
        if (raw !== null && raw > 0) {
          result[rule.fieldId] = UNIT[rule.unit](raw);
        }
      } else if (rule.type === 'range') {
        const r = findRangeValue(chunk, rule.keywords, rule.excludeKeywords);
        if (r && (r.min > 0 || r.max > 0)) {
          result[rule.fieldId + '-min'] = UNIT[rule.unit](r.min);
          result[rule.fieldId + '-max'] = UNIT[rule.unit](r.max);
        }
      }
    });

    // 合併規則一
    if (chunks.med_fixed) {
      const merged = mergeDailyOpRange(chunks.med_fixed);
      if (merged && (merged.min > 0 || merged.max > 0)) {
        result['daily-op-min'] = UNIT.raw(merged.min);
        result['daily-op-max'] = UNIT.raw(merged.max);
      }
    }

    // 合併規則二
    if (chunks.cancer) {
      const chemoVal = mergeCancerChemo(chunks.cancer);
      if (chemoVal !== null && chemoVal > 0) {
        result['cancer-chemo'] = UNIT.bai(chemoVal);
      }
    }

    return result;
  }

  global.InsuranceOCRMapping = { extractFieldsFromOcrText };

})(window);
// ===== 新增 OCR 功能結束 (mapping.js) =====
