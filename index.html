// ===== グローバル状態 =====
let GOOGLE_API_KEY = localStorage.getItem("GOOGLE_API_KEY") || "";
let lastReceipt = null;   // 構造化データ
let lastRawText = "";     // OCR全文

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");

// ===== APIキー設定 =====
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

// ===== カメラ起動（スマホ背面カメラ優先） =====
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

// ===== 撮影→OCR（Google Vision） =====
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
      lastRawText = "";
      return;
    }

    let text = data.responses[0].fullTextAnnotation.text;
    console.log("OCR raw text:", text);

    text = normalizeOcrText(text);
    lastRawText = text;

    lastReceipt = parseReceipt(text);
    output.textContent = JSON.stringify(lastReceipt, null, 2);
  } catch (e) {
    console.error(e);
    output.textContent = "通信エラーが発生しました: " + e.message;
  }
};

// ===== OCR誤字補正（簡易） =====
function normalizeOcrText(text) {
  return text
    .replace(/Ⅰ/g, "1")
    .replace(/Ｉ/g, "1")
    .replace(/O/g, "0")
    .replace(/〇/g, "0")
    .replace(/￥/g, "¥")
    .replace(/点/g, "")
    .replace(/円/g, "");
}

// ===== メイン解析 =====
function parseReceipt(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l);
  const joined = lines.join(" ");

  // 日付
  const dateMatch =
    joined.match(/(\d{4}年\d{1,2}月\d{1,2}日)/) ||
    joined.match(/(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/);
  const timeMatch = joined.match(/(\d{1,2}:\d{2})/);

  // 店名（ざっくり）
  let shop = "";
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    if (/[店スーパーセブンイレブンDAISOSEIYUアル・プラザバロー]/.test(lines[i])) {
      shop = lines[i];
      break;
    }
  }

  // 合計
  let total = "";
  const totalRegexes = [
    /合計\s*¥?\s*(\d{1,3}(,\d{3})*|\d+)/,
    /合計金額\s*¥?\s*(\d{1,3}(,\d{3})*|\d+)/,
    /ご利用金額\s*¥?\s*(\d{1,3}(,\d{3})*|\d+)/
  ];
  for (const r of totalRegexes) {
    const m = joined.match(r);
    if (m) {
      total = m[1].replace(/,/g, "");
      break;
    }
  }

  // 税率・税額
  let taxRate = "";
  let taxAmount = "";
  const taxRateMatch = joined.match(/(\d+)\s*%/);
  if (taxRateMatch) taxRate = taxRateMatch[1];

  const taxAmountMatch =
    joined.match(/消費税[額等]*\s*[:：]?\s*¥?\s*(\d{1,3}(,\d{3})*|\d+)/) ||
    joined.match(/内消費税[額等]*\s*[:：]?\s*¥?\s*(\d{1,3}(,\d{3})*|\d+)/);
  if (taxAmountMatch) taxAmount = taxAmountMatch[1].replace(/,/g, "");

  // 支払い方法
  let payment = "";
  if (/クレジット|カード|VISA|MASTER|JCB|ルビットクレジット/i.test(joined)) payment = "クレジットカード";
  else if (/PayPay|楽天ペイ|電子マネー|Suica|PASMO|WAON|nanaco/i.test(joined)) payment = "電子マネー/QR";
  else if (/HOPマネー/.test(joined)) payment = "HOPマネー";
  else if (/現金/.test(joined)) payment = "現金";

  // 明細（自動判別パーサー）
  const items = extractItemsAuto(lines);

  return {
    date: dateMatch ? dateMatch[1] : "",
    time: timeMatch ? timeMatch[1] : "",
    shop,
    total: total ? Number(total) : null,
    taxRate,
    taxAmount: taxAmount ? Number(taxAmount) : null,
    payment,
    items
  };
}

// ===== 店別＋汎用パーサー自動判別 =====
function extractItemsAuto(lines) {
  const joined = lines.join(" ");

  if (joined.includes("コメリ")) return parseKomeri(lines);
  if (joined.includes("ALPLAZA") || joined.includes("アル・プラザ")) return parseAlplaza(lines);
  if (joined.includes("セブン-イレブン") || joined.includes("7 セブン-イレブン")) return parseSeven(lines);
  if (joined.includes("SEIYU") || joined.includes("西友")) return parseSeiyu(lines);
  if (joined.includes("DAISO") || joined.includes("ダイソー")) return parseDaiso(lines);
  if (joined.includes("valer") || joined.includes("バロー")) return parseValor(lines);
  if (joined.includes("ENEOS")) return parseEneos(lines);
  if (joined.match(/km\/h/)) return []; // オドメーターは別扱い

  return extractMultiLineItems(lines);
}

// ===== コメリ =====
function parseKomeri(lines) {
  const items = [];
  let buffer = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const m = line.match(/^(\d+)\s+(.+?)\s+(\d+本束|\d+本|.+束)$/);
    if (m) {
      buffer = {
        code: m[1],
        name: m[2],
        qty: m[3],
        price: null
      };
      continue;
    }

    if (buffer && line.match(/^¥/)) {
      buffer.price = Number(line.replace(/[¥,\s]/g, ""));
      items.push(buffer);
      buffer = null;
    }
  }
  return items;
}

// ===== アルプラザ =====
function parseAlplaza(lines) {
  const items = [];
  let buffer = null;

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line.match(/^¥/)) {
      buffer = { name: line, qty: 1, price: null };
      continue;
    }
    if (buffer && line.match(/^¥/)) {
      buffer.price = Number(line.replace(/[¥,\s]/g, ""));
      items.push(buffer);
      buffer = null;
    }
  }
  return items;
}

// ===== セブンイレブン =====
function parseSeven(lines) {
  const items = [];
  let buffer = null;

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line.match(/^\*/)) {
      buffer = { name: line, qty: 1, price: null };
      continue;
    }
    if (buffer && line.match(/^\*/)) {
      buffer.price = Number(line.replace(/[^\d]/g, ""));
      items.push(buffer);
      buffer = null;
    }
  }
  return items;
}

// ===== 西友 =====
function parseSeiyu(lines) {
  const items = [];
  let buffer = null;

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    const m = line.match(/^(\d+)\s+(.+)/);
    if (m) {
      buffer = { code: m[1], name: m[2], qty: 1, price: null };
      continue;
    }
    if (buffer && line.match(/^¥/)) {
      buffer.price = Number(line.replace(/[¥,\sC]/g, ""));
      items.push(buffer);
      buffer = null;
    }
  }
  return items;
}

// ===== ダイソー =====
function parseDaiso(lines) {
  const items = [];
  let buffer = null;

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line.match(/^¥/)) {
      if (!line.match(/^\d+点$/)) {
        buffer = { name: line, qty: 1, price: null };
      }
      continue;
    }
    if (buffer && line.match(/^¥/)) {
      buffer.price = Number(line.replace(/[¥,\s]/g, ""));
      items.push(buffer);
      buffer = null;
    }
  }
  return items;
}

// ===== バロー =====
function parseValor(lines) {
  const items = [];
  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    const m = line.match(/^\*?\s*(.+?)\s+¥?\s*(\d{1,3}(,\d{3})*|\d+)$/);
    if (m) {
      items.push({
        code: "",
        name: m[1].replace(/^\*/, "").trim(),
        qty: 1,
        price: Number(m[2].replace(/,/g, ""))
      });
    }
  }
  return items;
}

// ===== ENEOS（ガソリン） =====
function parseEneos(lines) {
  const items = [];
  const fuel = lines.find(l => l.match(/レギュラー|ハイオク|軽油/));
  const qty = lines.find(l => l.match(/L/));

  if (fuel && qty) {
    items.push({
      code: "",
      name: fuel.trim(),
      qty: qty.replace(/[^0-9.]/g, ""),
      price: null
    });
  }
  return items;
}

// ===== 多行汎用パーサー =====
function extractMultiLineItems(lines) {
  const items = [];
  let buffer = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line.match(/^¥/) && !line.match(/^小計/) && !line.match(/^合計/) && !line.match(/^\d+点/)) {
      buffer = { code: "", name: line, qty: 1, price: null };
      continue;
    }

    const qtyMatch = line.match(/(\d+)\s*[xX]\s*(\d+)/);
    if (buffer && qtyMatch) {
      buffer.qty = Number(qtyMatch[1]);
      continue;
    }

    const priceMatch = line.match(/^¥?\s*(\d{1,3}(,\d{3})*|\d+)$/);
    if (buffer && priceMatch) {
      buffer.price = Number(priceMatch[1].replace(/,/g, ""));
      items.push(buffer);
      buffer = null;
      continue;
    }
  }

  return items;
}

// ===== 履歴保存（rawText＋photo＋parsed） =====
document.getElementById("saveHistory").onclick = () => {
  if (!lastRawText) {
    alert("保存できるOCRデータがありません");
    return;
  }

  const photoBase64 = canvas.toDataURL("image/jpeg", 0.8);
  const history = JSON.parse(localStorage.getItem("receiptHistory") || "[]");

  history.push({
    id: new Date().toISOString(),
    photo: photoBase64,
    rawText: lastRawText,
    parsed: lastReceipt
  });

  localStorage.setItem("receiptHistory", JSON.stringify(history));
  alert("写真＋OCR全文＋解析結果を保存しました");
};

// ===== 履歴表示 =====
document.getElementById("showHistory").onclick = () => {
  const history = JSON.parse(localStorage.getItem("receiptHistory") || "[]");
  const container = document.getElementById("history");
  let html = "";

  history.forEach(h => {
    html += `
      <div style="margin-bottom:16px; padding:8px; border-radius:8px; border:1px solid #ddd;">
        <div style="font-size:12px;color:#666;">${h.id}</div>
        <img src="${h.photo}" style="width:100%; max-width:320px; border-radius:6px; display:block; margin-top:4px;">
        <details style="margin-top:6px;">
          <summary>OCR全文</summary>
          <pre style="white-space:pre-wrap;font-size:11px;">${h.rawText}</pre>
        </details>
        <details style="margin-top:4px;">
          <summary>解析結果(parsed)</summary>
          <pre style="white-space:pre-wrap;font-size:11px;">${JSON.stringify(h.parsed, null, 2)}</pre>
        </details>
      </div>
    `;
  });

  container.innerHTML = html || "<p>履歴はまだありません。</p>";
};

// ===== 再解析ボタン（rawText→parseReceipt） =====
document.getElementById("reparse").onclick = () => {
  if (!lastRawText) {
    alert("再解析できるOCRテキストがありません");
    return;
  }
  lastReceipt = parseReceipt(lastRawText);
  output.textContent = JSON.stringify(lastReceipt, null, 2);
  alert("再解析しました");
};

// ===== 手入力補正エディタ =====
const editor = document.getElementById("editor");

document.getElementById("openEditor").onclick = () => {
  if (!lastReceipt) {
    alert("編集できる解析結果がありません（まずOCR→解析してください）");
    return;
  }
  document.getElementById("editDate").value = lastReceipt.date || "";
  document.getElementById("editTime").value = lastReceipt.time || "";
  document.getElementById("editShop").value = lastReceipt.shop || "";
  document.getElementById("editTotal").value = lastReceipt.total ?? "";
  document.getElementById("editTaxRate").value = lastReceipt.taxRate || "";
  document.getElementById("editTaxAmount").value = lastReceipt.taxAmount ?? "";
  document.getElementById("editPayment").value = lastReceipt.payment || "";
  document.getElementById("editItems").value = JSON.stringify(lastReceipt.items || [], null, 2);
  editor.style.display = "block";
};

document.getElementById("closeEditor").onclick = () => {
  editor.style.display = "none";
};

document.getElementById("saveEdit").onclick = () => {
  try {
    const items = JSON.parse(document.getElementById("editItems").value || "[]");
    lastReceipt = {
      date: document.getElementById("editDate").value,
      time: document.getElementById("editTime").value,
      shop: document.getElementById("editShop").value,
      total: document.getElementById("editTotal").value ? Number(document.getElementById("editTotal").value) : null,
      taxRate: document.getElementById("editTaxRate").value,
      taxAmount: document.getElementById("editTaxAmount").value ? Number(document.getElementById("editTaxAmount").value) : null,
      payment: document.getElementById("editPayment").value,
      items
    };
    output.textContent = JSON.stringify(lastReceipt, null, 2);
    alert("編集内容を反映しました（この状態で履歴保存すると新規として保存されます）");
  } catch (e) {
    alert("明細(JSON)の形式が不正です: " + e.message);
  }
};

// ===== Excel家計簿出力（履歴全体） =====
document.getElementById("downloadExcel").onclick = () => {
  const history = JSON.parse(localStorage.getItem("receiptHistory") || "[]");
  if (history.length === 0) {
    alert("履歴がありません");
    return;
  }

  const rows = [];
  rows.push([
    "日付","時間","店名","品番","品名","数量","金額","合計金額","消費税率","消費税","支払い方法"
  ]);

  history.forEach(h => {
    const r = h.parsed;
    if (!r) return;
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
      rows.push([
        r.date || "",
        r.time || "",
        r.shop || "",
        "",
        "",
        "",
        "",
        r.total ?? "",
        r.taxRate || "",
        r.taxAmount ?? "",
        r.payment || ""
      ]);
    }
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "家計簿");
  XLSX.writeFile(wb, "kakeibo_receipts.xlsx");
};

// ===== ZIP保存（日付フォルダ／写真＋rawText＋parsed） =====
document.getElementById("downloadZip").onclick = async () => {
  const history = JSON.parse(localStorage.getItem("receiptHistory") || "[]");
  if (history.length === 0) {
    alert("履歴がありません");
    return;
  }

  const zip = new JSZip();

  history.forEach((h, idx) => {
    const dateKey =
      h.parsed && h.parsed.date
        ? h.parsed.date.replace(/[\/\.年月日]/g, "-")
        : "unknown";
    const folder = zip.folder(`${dateKey}/receipt_${idx + 1}`);

    const base64 = h.photo.split(",")[1];
    folder.file("photo.jpg", base64, { base64: true });
    folder.file("rawText.txt", h.rawText || "");
    folder.file("parsed.json", JSON.stringify(h.parsed, null, 2));
  });

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "receipts_by_date.zip";
  a.click();
};

// ===== ファイル読み込み（画像/将来拡張用） =====
document.getElementById("loadFile").onclick = async () => {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return alert("ファイルを選択してください");

  const ext = file.name.split(".").pop().toLowerCase();
  if (["jpg","jpeg","png"].includes(ext)) {
    const reader = new FileReader();
    reader.onload = async e => {
      const img = new Image();
      img.onload = async () => {
        const ctx = canvas.getContext("2d");
        const maxSize = 1024;
        let w = img.width;
        let h = img.height;
        if (w > h && w > maxSize) {
          h = Math.floor(h * (maxSize / w));
          w = maxSize;
        } else if (h >= w && h > maxSize) {
          w = Math.floor(w * (maxSize / h));
          h = maxSize;
        }
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
        await ocrBase64(base64);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  } else {
    alert("今は画像ファイル(jpg/png)のみ対応にしています。");
  }
};

// 画像Base64からOCR（カメラと共通処理）
async function ocrBase64(base64) {
  if (!GOOGLE_API_KEY) {
    alert("先にAPIキーを設定してください");
    return;
  }
  output.textContent = "OCR中...";

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
      output.textContent = "OCRに失敗しました。";
      lastReceipt = null;
      lastRawText = "";
      return;
    }

    let text = data.responses[0].fullTextAnnotation.text;
    text = normalizeOcrText(text);
    lastRawText = text;
    lastReceipt = parseReceipt(text);
    output.textContent = JSON.stringify(lastReceipt, null, 2);
  } catch (e) {
    console.error(e);
    output.textContent = "通信エラーが発生しました: " + e.message;
  }
}
