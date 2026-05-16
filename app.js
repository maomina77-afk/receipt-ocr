let GOOGLE_API_KEY = localStorage.getItem("GOOGLE_API_KEY") || "";
let lastReceipt = null; // 1枚分のレシート（ヘッダ＋明細）
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");

// ① APIキー設定
document.getElementById("setApiKey").onclick = () => {
  const key = document.getElementById("apiKeyInput").value.trim();
  if (!key) {
    alert("APIキーを入力してください");
    return;
  }
  GOOGLE_API_KEY = key;
  localStorage.setItem("GOOGLE_API_KEY", key);
  alert("APIキーを設定しました");
};

// ② カメラ起動
document.getElementById("start").onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    video.srcObject = stream;
  } catch (e) {
    alert("カメラが使えません: " + e.message);
  }
};

// ③ 撮影してOCR（スマホ向けに縮小＋日本語指定＋DOCUMENT_TEXT_DETECTION）
document.getElementById("capture").onclick = async () => {
  if (!GOOGLE_API_KEY) {
    alert("先にAPIキーを設定してください");
    return;
  }
  if (!video.videoWidth || !video.videoHeight) {
    alert("カメラ準備中です。数秒待ってから再度お試しください。");
    return;
  }

  const originalWidth = video.videoWidth;
  const originalHeight = video.videoHeight;
  const maxSize = 1024;
  let targetWidth = originalWidth;
  let targetHeight = originalHeight;

  if (originalWidth > originalHeight) {
    if (originalWidth > maxSize) {
      targetWidth = maxSize;
      targetHeight = Math.floor(originalHeight * (maxSize / originalWidth));
    }
  } else {
    if (originalHeight > maxSize) {
      targetHeight = maxSize;
      targetWidth = Math.floor(originalWidth * (maxSize / originalHeight));
    }
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

  const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];

  output.textContent = "OCR中...（数秒かかります）";

  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
              imageContext: { languageHints: ["ja"] }
            }
          ]
        })
      }
    );

    const data = await response.json();
    if (!data.responses || !data.responses[0].fullTextAnnotation) {
      console.log("Vision API response:", data);
      output.textContent = "OCRに失敗しました。明るい場所で、レシートを画面いっぱいに撮影してください。";
      lastReceipt = null;
      return;
    }

    const text = data.responses[0].fullTextAnnotation.text;
    console.log("OCR text:", text);

    lastReceipt = parseReceipt(text);

    output.textContent = JSON.stringify(lastReceipt, null, 2);
  } catch (e) {
    console.error(e);
    output.textContent = "通信エラーが発生しました: " + e.message;
  }
};

// ④ レシート解析：日時、店名、明細、合計、税率、支払い方法など
function parseReceipt(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l);
  const joined = lines.join(" ");

  // 日付・時間
  const dateMatch =
    joined.match(/(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/) ||
    joined.match(/(\d{2}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/);
  const timeMatch = joined.match(/(\d{1,2}:\d{2})/);

  const date = dateMatch ? dateMatch[1] : "";
  const time = timeMatch ? timeMatch[1] : "";

  // 店名（先頭〜数行のうち、「店」「支店」「スーパー」「ドラッグ」などを含む行を優先）
  let shop = lines[0] || "";
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (/[店支店スーパードラッグ薬局]/.test(lines[i])) {
      shop = lines[i];
      break;
    }
  }

  // 合計金額
  let total = "";
  const totalRegexes = [
    /合計\s*[:：]?\s*(\d{1,3}(,\d{3})*|\d+)/,
    /お買上げ金額\s*[:：]?\s*(\d{1,3}(,\d{3})*|\d+)/
  ];
  for (const r of totalRegexes) {
    const m = joined.match(r);
    if (m) {
      total = m[1].replace(/,/g, "");
      break;
    }
  }

  // 消費税率・消費税
  let taxRate = "";
  let taxAmount = "";
  const taxRateMatch = joined.match(/(\d+)%/);
  if (taxRateMatch) taxRate = taxRateMatch[1];

  const taxAmountMatch =
    joined.match(/消費税\s*[:：]?\s*(\d{1,3}(,\d{3})*|\d+)/) ||
    joined.match(/税額\s*[:：]?\s*(\d{1,3}(,\d{3})*|\d+)/);
  if (taxAmountMatch) taxAmount = taxAmountMatch[1].replace(/,/g, "");

  // 支払い方法
  let payment = "";
  if (/クレジット|カード|VISA|MASTER|JCB/i.test(joined)) payment = "クレジットカード";
  else if (/Pay|ペイ|電子マネー/i.test(joined)) payment = "電子マネー/QR";
  else if (/現金/.test(joined)) payment = "現金";

  // 明細（品番・品名・数量・金額）
  const items = [];
  const itemRegex = /^(.+?)\s+(\d+)\s+(\d{1,3}(,\d{3})*|\d+)$/;

  for (const line of lines) {
    const m = line.match(itemRegex);
    if (m) {
      const rawName = m[1].trim();
      let code = "";
      let name = rawName;

      // 先頭に数字が続く場合を品番とみなす（例: 123456 牛乳）
      const codeMatch = rawName.match(/^(\d{4,})\s+(.+)/);
      if (codeMatch) {
        code = codeMatch[1];
        name = codeMatch[2];
      }

      items.push({
        code,
        name,
        qty: Number(m[2]),
        price: Number(m[3].replace(/,/g, ""))
      });
    }
  }

  return {
    rawText: text,
    date,
    time,
    shop,
    total: total ? Number(total) : null,
    taxRate,
    taxAmount: taxAmount ? Number(taxAmount) : null,
    payment,
    items
  };
}

// ⑤ 履歴保存（localStorage）
document.getElementById("saveHistory").onclick = () => {
  if (!lastReceipt) {
    alert("保存できるレシートデータがありません");
    return;
  }
  const history = JSON.parse(localStorage.getItem("receiptHistory") || "[]");
  history.push(lastReceipt);
  localStorage.setItem("receiptHistory", JSON.stringify(history));
  alert("履歴に保存しました");
};

// ⑥ 履歴表示
document.getElementById("showHistory").onclick = () => {
  const history = JSON.parse(localStorage.getItem("receiptHistory") || "[]");
  document.getElementById("history").textContent =
    JSON.stringify(history, null, 2);
};

// ⑦ 履歴をExcel家計簿としてダウンロード
document.getElementById("downloadExcel").onclick = () => {
  const history = JSON.parse(localStorage.getItem("receiptHistory") || "[]");
  if (history.length === 0) {
    alert("履歴がありません");
    return;
  }

  const rows = [];
  rows.push([
    "日付",
    "時間",
    "店名",
    "品番",
    "品名",
    "数量",
    "金額",
    "合計金額",
    "消費税率",
    "消費税",
    "支払い方法"
  ]);

  history.forEach(r => {
    const base = [
      r.date || "",
      r.time || "",
      r.shop || "",
      "", "", "", "",
      r.total ?? "",
      r.taxRate || "",
      r.taxAmount ?? "",
      r.payment || ""
    ];

    if (r.items && r.items.length > 0) {
      r.items.forEach(item => {
        rows.push([
          r.date || "",
          r.time || "",
          r.shop || "",
          item.code || "",
          item.name || "",
          item.qty ?? "",
          item.price ?? "",
          r.total ?? "",
          r.taxRate || "",
          r.taxAmount ?? "",
          r.payment || ""
        ]);
      });
    } else {
      rows.push(base);
    }
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "家計簿");
  XLSX.writeFile(wb, "kakeibo_receipts.xlsx");
};
