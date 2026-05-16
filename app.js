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
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" }
  });
  video.srcObject = stream;
};

// 撮影してOCR
document.getElementById("capture").onclick = async () => {
  if (!GOOGLE_API_KEY) {
    alert("先にAPIキーを設定してください");
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  const base64 = canvas.toDataURL("image/jpeg").split(",")[1];

  output.textContent = "OCR中...";

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
  const text = data.responses[0].fullTextAnnotation.text;

  lastExtractedItems = extractItems(text);

  output.textContent = JSON.stringify(lastExtractedItems, null, 2);
};

// 品名・数量・金額を抽出
function extractItems(text) {
  const lines = text.split("\n");
  const items = [];

  const itemRegex = /^(.+?)\s+(\d+)\s+(\d{1,3}(,\d{3})*|\d+)$/;

  for (const line of lines) {
    const m = line.match(itemRegex);
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
  if (lastExtractedItems.length === 0) {
    alert("抽出データがありません");
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
