// ===== 新增 Google Sheets 整合開始 (sheets.js) =====
// 使用方式（詳見 README-OCR與GoogleSheets設定說明.md）：
//   1. 依 README 完成 Google Apps Script 部署，取得「網頁應用程式網址」(結尾通常是 /exec)
//   2. 貼到下面 GOOGLE_SHEETS_WEBAPP_URL
//   3. 保障卡片頁下方會多一顆「同步至 Google Sheet」按鈕，點擊後把目前表單所有欄位送出一筆紀錄

const GOOGLE_SHEETS_WEBAPP_URL = '請貼上你的 Apps Script Web App URL（例如 https://script.google.com/macros/s/xxxx/exec）';

// 會被送出的欄位清單（順序需與 Google Apps Script 裡的 headers 一致）
const SHEETS_FIELD_IDS = [
  'clientName', 'planDate',
  'critical-amount', 'critical-age', 'critical-lifetime', 'disease-amount', 'disease-age', 'disease-lifetime',
  'daily-hosp', 'daily-nurse', 'daily-post', 'daily-op-min', 'daily-op-max', 'daily-age', 'daily-lifetime',
  'reimb-room', 'reimb-misc', 'reimb-op-min', 'reimb-op-max', 'reimb-age', 'reimb-lifetime',
  'acc-death', 'acc-reimb', 'acc-daily', 'acc-fracture', 'acc-age', 'acc-lifetime',
  'cancer-hosp', 'cancer-post', 'cancer-chemo', 'cancer-op', 'cancer-care-amt', 'cancer-care-yrs', 'cancer-age', 'cancer-lifetime',
  'longcare-lump', 'longcare-monthly', 'longcare-age', 'longcare-lifetime',
  'life-amount', 'life-age', 'life-lifetime',
  'finance-note', 'retire-note',
];

function collectFormData() {
  const data = { timestamp: new Date().toISOString() };
  SHEETS_FIELD_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    data[id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  return data;
}

async function sendToGoogleSheets() {
  if (!GOOGLE_SHEETS_WEBAPP_URL || GOOGLE_SHEETS_WEBAPP_URL.indexOf('請貼上') !== -1) {
    alert('尚未設定 Google Sheets 的 Web App URL，請參考 README 完成部署後再試一次。');
    return;
  }

  const btn = document.getElementById('syncSheetsBtn');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '同步中…';
  }

  try {
    const payload = collectFormData();
    // 用 text/plain 避免觸發 CORS 預檢請求（Apps Script 對 preflight 支援不佳的常見解法）
    await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    alert('已送出至 Google Sheet！');
  } catch (err) {
    alert('同步失敗：' + (err && err.message ? err.message : '未知錯誤'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}
// ===== 新增 Google Sheets 整合結束 (sheets.js) =====
