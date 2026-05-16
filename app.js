let GOOGLE_API_KEY = "";
let lastExtractedItems = [];

// ローカルの config.json を読み込む
document.getElementById("configFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const text = await file.text();
  const json = JSON.parse(text);

  GOOGLE_API_KEY = json.GOOGLE_API_KEY;

  alert("APIキーを読み込みました！");
});

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");

// カメラ起動
document.getElementById("start").onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" }
  });
  video.srcObject = stream;
};

// 撮影してOCR
document.getElementById("capture").onclick = async () => {
  if (!GOOGLE_API_KEY) {
    alert("先に config.json を読み込んでください");
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

// Excel保存
document.getElementById("saveExcel").onclick = () => {
  if (lastExtractedItems.length === 0) {
    alert("抽出データがありません");
    return;
  }

  saveToExcel(lastExtractedItems);
};
