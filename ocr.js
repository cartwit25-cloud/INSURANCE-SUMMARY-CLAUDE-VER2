// ===== 新增 OCR 功能開始 (ocr.js) =====
// 圖片匯入 OCR 功能：
//   1. 使用 Tesseract.js 在瀏覽器本機辨識保單圖片文字（完全免費、不需 API Key、可部署到 GitHub Pages）
//   2. 辨識完成後，透過 mapping.js 的 InsuranceOCRMapping 比對「中文名稱 → 網站欄位」
//   3. 只把資料「填入」現有表單欄位，不會自動送出、不會自動觸發 generate()
//      → 使用者仍可在表單頁自由手動修改，確認無誤後再自行按「生成保障卡片」

// 欄位 ID 對應的中文顯示名稱，僅用於狀態訊息顯示，不影響網站原有邏輯
const OCR_FIELD_LABELS = {
  'life-amount': '壽險保額',
  'acc-death': '意外身故/失能',
  'acc-reimb': '意外實支實付',
  'acc-daily': '意外住院日額',
  'daily-hosp': '住院日額',
  'daily-nurse': '住院看護',
  'daily-post': '出院療養',
  'daily-op-min': '定額手術(最低，已併入住院手術看護)',
  'daily-op-max': '定額手術(最高，已併入住院手術看護)',
  'reimb-room': '病房費',
  'reimb-misc': '雜費限額',
  'reimb-op-min': '實支手術(最低)',
  'reimb-op-max': '實支手術(最高)',
  'cancer-hosp': '癌症住院',
  'cancer-post': '癌症出院療養',
  'cancer-chemo': '放射/化療(取較大值)',
  'cancer-op': '癌症手術(重度)',
  'cancer-care-amt': '生存照顧金',
  'critical-amount': '重大傷病',
  'disease-amount': '重大疾病',
  'longcare-lump': '長照一次金',
  'longcare-monthly': '長照月給付',
};

async function handleOcrImageSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('ocrStatus');
  const importBtn = document.getElementById('ocrImportBtn');

  statusEl.style.display = 'block';
  statusEl.className = 'ocr-status ocr-loading';
  statusEl.textContent = '正在辨識圖片文字，請稍候…（0%）';
  importBtn.disabled = true;

  try {
    if (typeof Tesseract === 'undefined') {
      throw new Error('OCR 引擎（Tesseract.js）載入失敗，請檢查網路連線後重新整理頁面再試一次。');
    }

    const { data } = await Tesseract.recognize(file, 'chi_tra', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          statusEl.textContent = `正在辨識圖片文字，請稍候…（${pct}%）`;
        }
      },
    });

    const rawText = data && data.text ? data.text : '';
    if (!rawText.trim()) {
      throw new Error('沒有辨識出任何文字，請確認圖片清晰度後再試一次。');
    }

    if (!window.InsuranceOCRMapping) {
      throw new Error('對應規則模組（mapping.js）未正確載入。');
    }

    const fields = window.InsuranceOCRMapping.extractFieldsFromOcrText(rawText);
    const filledLabels = applyFieldsToForm(fields);

    if (filledLabels.length) {
      statusEl.className = 'ocr-status ocr-success';
      statusEl.textContent =
        '✅ 已自動填入以下欄位，請務必人工核對後再手動修改、確認無誤再送出：\n' +
        filledLabels.join('、');
    } else {
      statusEl.className = 'ocr-status ocr-error';
      statusEl.textContent = '⚠️ 辨識完成，但沒有比對到任何可填入的欄位，請手動輸入資料。';
    }
  } catch (err) {
    statusEl.className = 'ocr-status ocr-error';
    statusEl.textContent =
      '❌ 辨識失敗：' + (err && err.message ? err.message : '未知錯誤') + '，請重新選擇圖片再試一次。';
  } finally {
    importBtn.disabled = false;
    event.target.value = ''; // 清空選擇，允許重新選同一張圖再試
  }
}

// 把 mapping.js 解析出的結果實際填入頁面上的 input/textarea
// 並手動觸發 input/change 事件，讓網站原本既有的加總邏輯
// （updateDailySum / updateCancerSum）能自動重新計算，不需要另外呼叫
function applyFieldsToForm(fields) {
  const filled = [];
  Object.keys(fields).forEach((fieldId) => {
    const input = document.getElementById(fieldId);
    if (!input) return;
    input.value = fields[fieldId];
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    filled.push(OCR_FIELD_LABELS[fieldId] || fieldId);
  });
  return filled;
}
// ===== 新增 OCR 功能結束 (ocr.js) =====
