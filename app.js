let GOOGLE_API_KEY = localStorage.getItem("GOOGLE_API_KEY") || "";
let lastExtractedItems = [];

// APIキー設定
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

// カメラ起動
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");

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

// 撮影してOCR（スマホ向けに縮小してから送信）
document.getElementById("capture").onclick = async () => {
  if (!GOOGLE_API_KEY) {
    alert("先にAPIキーを設定してください");
    return;
  }

  if (!video.videoWidth || !video.videoHeight) {
    alert("カメラがまだ準備できていません。少し待ってから再度お試しください。");
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
              features: [{ type: "TEXT_DETECTION" }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!data.responses || !data.responses[0].fullTextAnnotation) {
      console.log("Vision API response:", data);
      output.textContent = "OCRに失敗しました。明るい場所で、レシートを画面いっぱいに撮影してみてください。";
      lastExtractedItems = [];
      return;
    }

    const text = data.responses[0].fullTextAnnotation.text;
    console.log("OCR text:", text);

    lastExtractedItems = extractItems(text);

    if (lastExtractedItems.length === 0) {
      output.textContent = "テキストは読み取れましたが、品名・数量・金額の形式が見つかりませんでした。\n\n--- OCRテキスト ---\n" + text;
    } else {
      output.textContent = JSON.stringify(lastExtractedItems, null, 2);
    }
  } catch (e) {
    console.error(e);
    output.textContent = "通信エラーが発生しました: " + e.message;
  }
};

// 品名・数量・金額を抽出
function extractItems(text) {
  const lines = text.split("\n");
  const items = [];

  // 例: 「牛乳 2 198」や「牛乳    2    198」など
  const itemRegex = /^(.+?)\s+(\d+)\s+(\d{1,3}(,\d{3})*|\d+)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(itemRegex);
    if (m) {
      items.push({
        name: m[1].trim(),
        qty: Number(m[2]),
        price: Number(m[3].replace(/,/g, ""))
      });
    }
  }

  return items;
}

// 履歴保存
document.getElementById("saveHistory").onclick = () => {
  if (!lastExtractedItems || lastExtractedItems.length === 0) {
    alert("保存できる抽出データがありません");
    return;
  }

  const history = JSON.parse(localStorage.getItem("receiptHistory") || "[]");
  history.push({
    date: new Date().toISOString(),
    items: lastExtractedItems
  });

  localStorage.setItem("receiptHistory", JSON.stringify(history));
  alert("履歴に保存しました");
};

// 履歴表示
document.getElementById("showHistory").onclick = () => {
  const history = JSON.parse(localStorage.getItem("receiptHistory") || "[]");
  document.getElementById("history").textContent =
    JSON.stringify(history, null, 2);
};
