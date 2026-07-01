# 保單匯總工具 － OCR 匯入 + Google Sheets 同步 說明

## 檔案架構

```
index.html                                  ← 原有網頁（只做局部新增，原功能不變）
mapping.js                                   ← 新增：中文名稱 → 網站欄位 Mapping 邏輯
ocr.js                                        ← 新增：圖片 OCR 辨識 + 自動填表
sheets.js                                     ← 新增：Google Sheets 同步（fetch）
google-apps-script.gs                         ← 新增：貼到 Google Apps Script 的後端程式
README-OCR與GoogleSheets設定說明.md            ← 本說明檔（不需要上傳到 GitHub Pages）
```

把前 4 個檔案（index.html / mapping.js / ocr.js / sheets.js）放在 GitHub Pages 同一個資料夾覆蓋即可，**不需要任何後端伺服器**（Google Apps Script 是 Google 自己的免費服務，不算後端伺服器）。

---

## 一、圖片 OCR 匯入（已可直接使用，不需任何設定）

1. 開啟網站，在表單頁最上方會看到「匯入保單圖片（OCR 自動辨識）」卡片
2. 點「選擇保單圖片並自動辨識」，選擇保單整理圖（jpg/png）
3. 系統會在瀏覽器本機用 Tesseract.js 辨識文字（完全免費、不需 API Key、不會上傳到任何伺服器）
4. 辨識完成後自動填入對應欄位，並顯示「已自動填入哪些欄位」的提示
5. **請務必人工核對每個欄位**，確認或修改後，再按最下方「生成保障卡片」

### 目前支援自動辨識/填入的欄位
壽險保額、意外身故/失能、意外實支實付、意外住院日額、住院日額、住院看護、出院療養、
定額手術（已合併「住院手術」與「住院手術看護」的範圍）、病房費、雜費限額、實支手術範圍、
癌症住院、癌症出院療養、放射/化療（化學醫療與放射線醫療取較大值）、癌症手術（重度）、
生存照顧金、重大傷病、重大疾病、長照一次金、長照月給付。

### 目前保單圖片上有但網站沒有對應欄位、會直接略過的項目
意外失能（範圍）、門診手術、初次罹癌保險金（重度/初期）、特定傷病、失能扶助相關項目。
如果之後需要接住這些項目，需要先在網站新增對應的輸入欄位，再回來擴充 `mapping.js` 的
`FIELD_RULES`，不需要動到其他檔案。

---

## 二、Google Sheets 同步設定步驟

### 1. 建立 Google Sheet
開一份新的 Google Sheet（空白即可，不需要先建欄位，程式會自動加表頭）。

### 2. 貼上 Apps Script 程式
- 在 Sheet 上方選單點「擴充功能」→「Apps Script」
- 把 `google-apps-script.gs` 的內容整份貼進去，取代預設內容
- 按存檔（Ctrl/Cmd + S）

### 3. 部署為網頁應用程式
- 右上角「部署」→「新增部署作業」
- 類型選擇「網頁應用程式」
- 設定：
  - 執行身份：**我**
  - 具有存取權的使用者：**所有人**
- 按「部署」，過程中會要求你授權（第一次會跳出「未經驗證的應用程式」警告，這是 Google 對自己帳號寫的程式的正常提示，選擇「繼續」授權即可）
- 部署完成後複製「網頁應用程式網址」（網址結尾通常是 `/exec`）

### 4. 設定網站
打開 `sheets.js`，把這一行的網址換成你剛剛複製的網址：

```js
const GOOGLE_SHEETS_WEBAPP_URL = '請貼上你的 Apps Script Web App URL（例如 https://script.google.com/macros/s/xxxx/exec）';
```

### 5. 測試
- 覆蓋 GitHub Pages 上的檔案
- 打開網站，填資料 → 生成保障卡片 → 點「同步至 Google Sheet」
- 回去 Google Sheet 檢查是否新增一列資料

---

## 三、Google Sheet 欄位格式

Apps Script 第一次寫入時，會自動在工作表 **「保單資料」** 加上以下表頭（依序）：

| 欄位 | 說明 |
|---|---|
| timestamp | 送出時間（ISO 格式） |
| clientName | 客戶姓名 |
| planDate | 建議書日期 |
| critical-amount / critical-age / critical-lifetime | 重大傷病 保額/效期/是否終身 |
| disease-amount / disease-age / disease-lifetime | 重大疾病 保額/效期/是否終身 |
| daily-hosp / daily-nurse / daily-post | 住院日額/看護/出院療養（百元） |
| daily-op-min / daily-op-max | 定額手術 最低/最高 |
| daily-age / daily-lifetime | 日額/手術 效期/是否終身 |
| reimb-room / reimb-misc | 病房費/雜費限額 |
| reimb-op-min / reimb-op-max | 實支手術 最低/最高 |
| reimb-age / reimb-lifetime | 實支實付 效期/是否終身 |
| acc-death / acc-reimb / acc-daily / acc-fracture | 意外 身故失能/實支實付/住院日額/骨折 |
| acc-age / acc-lifetime | 意外險 效期/是否終身 |
| cancer-hosp / cancer-post / cancer-chemo / cancer-op / cancer-care-amt / cancer-care-yrs | 癌症險各項目 |
| cancer-age / cancer-lifetime | 癌症險 效期/是否終身 |
| longcare-lump / longcare-monthly | 長照 一次金/月給付 |
| longcare-age / longcare-lifetime | 長照 效期/是否終身 |
| life-amount / life-age / life-lifetime | 壽險 保額/效期/是否終身 |
| finance-note / retire-note | 理財/退休 說明文字 |

若之後在網站新增新欄位，記得同時在 `sheets.js` 的 `SHEETS_FIELD_IDS` 與
`google-apps-script.gs` 的 `headers` 兩處加上同名的欄位 ID（順序需一致），否則新欄位不會被送出/寫入。

---

## 已知限制

- OCR 正確率會受圖片清晰度、字體大小、掃描/拍照品質影響，**永遠需要人工核對**，這是設計上刻意保留的步驟，不會自動送出。
- 若保單圖片版面跟這次提供的範例差異很大（例如標題文字不同、章節順序不同），`mapping.js` 的章節關鍵字可能對不上，屆時可以直接調整 `SECTIONS` 與 `FIELD_RULES` 裡的關鍵字，不需要改其他檔案。
- Google Apps Script 免費額度足夠一般業務員日常使用，但仍屬於 Google 帳號的每日配額限制（一般情況下不會用到上限）。
