// Google Apps Script - 保單資料寫入 Google Sheet
// 部署步驟請見 README-OCR與GoogleSheets設定說明.md

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('保單資料') || ss.insertSheet('保單資料');

    // 欄位順序需與網站 sheets.js 裡的 SHEETS_FIELD_IDS 一致
    var headers = [
      'timestamp', 'clientName', 'planDate',
      'critical-amount', 'critical-age', 'critical-lifetime', 'disease-amount', 'disease-age', 'disease-lifetime',
      'daily-hosp', 'daily-nurse', 'daily-post', 'daily-op-min', 'daily-op-max', 'daily-age', 'daily-lifetime',
      'reimb-room', 'reimb-misc', 'reimb-op-min', 'reimb-op-max', 'reimb-age', 'reimb-lifetime',
      'acc-death', 'acc-reimb', 'acc-daily', 'acc-fracture', 'acc-age', 'acc-lifetime',
      'cancer-hosp', 'cancer-post', 'cancer-chemo', 'cancer-op', 'cancer-care-amt', 'cancer-care-yrs', 'cancer-age', 'cancer-lifetime',
      'longcare-lump', 'longcare-monthly', 'longcare-age', 'longcare-lifetime',
      'life-amount', 'life-age', 'life-lifetime',
      'finance-note', 'retire-note',
    ];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    }

    var row = headers.map(function (key) {
      var v = data[key];
      if (v === undefined || v === null) return '';
      return v;
    });
    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
