// =========================
// グローバル状態
// =========================
let GOOGLE_API_KEY = localStorage.getItem("GOOGLE_API_KEY") || "";
let lastRawText = "";
let lastPhotoBase64 = "";
let cropper = null;
let currentStream = null;

// DOM取得
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

const btnSetApiKey = document.getElementById("setApiKey");
const btnStart = document.getElementById("start");
const btnCapture = document.getElementById("capture");
const btnLoadFile = document.getElementById("loadFile");
const btnShowHistory = document.getElementById("showHistory");
const btnDownloadZip = document.getElementById("downloadZip");

const previewArea = document.getElementById("previewArea");
const previewImage = document.getElementById("previewImage");
const btnDoCrop = document.getElementById("doCrop");
const btnCancelPreview = document.getElementById("cancelPreview");

const editOverlay = document.getElementById("editOverlay");
const editText = document.getElementById("editText");
const btnConfirmEdit = document.getElementById("confirmEdit");
const btnCancelEdit = document.getElementById("cancelEdit");

// =========================
// ビープ音
// =========================
function beep(success = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = success ? 880 : 440;
    gain.gain.value = 0.1;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 150);
  } catch (e) {}
}

// =========================
// OCR中のボタン状態
// =========================
function setOcrBusy(isBusy) {
  const busyColor = "#f57c00";
  const normalColor = "#1976d2";

  if (isBusy) {
    btnCapture.style.backgroundColor = busyColor;
    btnCapture.textContent = "OCR中…";
    btnCapture.disabled = true;

    btnLoadFile.style.backgroundColor = busyColor;
    btnLoadFile.textContent = "OCR中…";
    btnLoadFile.disabled = true;
  } else {
    btnCapture.style.backgroundColor = normalColor;
    btnCapture.textContent = "撮影してOCR";
    btnCapture.disabled = false;

    btnLoadFile.style.backgroundColor = "#555";
    btnLoadFile.textContent = "画像ファイルをOCR";
    btnLoadFile.disabled = false;
  }
}

// =========================
// APIキー設定
// =========================
btnSetApiKey.onclick = () => {
  const key = document.getElementById("apiKeyInput").value.trim();
  if (!key) {
    alert("APIキーを入力してください");
    return;
  }
  GOOGLE_API_KEY = key;
  localStorage.setItem("GOOGLE_API_KEY", key);
  alert("APIキーを設定しました");
};

// =========================
// カメラ起動（ズーム対応）
// =========================
btnStart.onclick = async () => {
  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    });

    video.srcObject = currentStream;

    // ズーム対応（可能な端末のみ）
    const track = currentStream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    if (capabilities.zoom) {
      track.applyConstraints({
        advanced: [{ zoom: capabilities.zoom.min }]
      });
    }

  } catch (e) {
    alert("カメラが使えません: " + e.message);
  }
};

// =========================
// 撮影 → プレビュー表示（Cropper.js）
// =========================
btnCapture.onclick = () => {
  if (!video.videoWidth || !video.videoHeight) {
    alert("カメラ準備中です。数秒待ってください。");
    return;
  }

  // カメラ停止
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }

  // 撮影
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  lastPhotoBase64 = dataUrl;

  // プレビュー表示
  previewImage.src = dataUrl;
  previewArea.style.display = "block";

  // Cropper.js 初期化
  if (cropper) cropper.destroy();
  cropper = new Cropper(previewImage, {
    viewMode: 1,
    dragMode: "move",
    background: false,
    autoCropArea: 1.0
  });
};

// =========================
// プレビュー → OCR実行
// =========================
btnDoCrop.onclick = async () => {
  if (!cropper) return;

  const croppedCanvas = cropper.getCroppedCanvas({
    maxWidth: 1024,
    maxHeight: 1024
  });

  const dataUrl = croppedCanvas.toDataURL("image/jpeg", 0.9);
  const base64 = dataUrl.split(",")[1];
  lastPhotoBase64 = dataUrl;

  previewArea.style.display = "none";

  await ocrBase64(base64);
};

// =========================
// プレビューキャンセル
// =========================
btnCancelPreview.onclick = () => {
  previewArea.style.display = "none";
  if (cropper) cropper.destroy();
  cropper = null;
};

// =========================
// OCR実行
// =========================
async function ocrBase64(base64) {
  if (!GOOGLE_API_KEY) {
    alert("APIキーを設定してください");
    return;
  }

  setOcrBusy(true);

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
      alert("OCRに失敗しました。");
      beep(false);
      return;
    }

    let text = data.responses[0].fullTextAnnotation.text || "";
    text = normalizeOcrText(text);
    lastRawText = text;

    openEditOverlay(text);
    beep(true);

  } catch (e) {
    alert("通信エラー: " + e.message);
    beep(false);
  } finally {
    setOcrBusy(false);
  }
}

// =========================
// OCR誤字補正
// =========================
function normalizeOcrText(text) {
  return text
    .replace(/Ⅰ/g, "1")
    .replace(/Ｉ/g, "1")
    .replace(/O/g, "0")
    .replace(/〇/g, "0")
    .replace(/￥/g, "¥");
}

// =========================
// 編集ボトムシート
// =========================
function openEditOverlay(text) {
  editText.value = text;
  editOverlay.style.bottom = "0px";
}

function closeEditOverlay() {
  editOverlay.style.bottom = "-80vh";
}

// ドラッグで高さ可変
let startY = 0;
let startBottom = 0;

editOverlay.addEventListener("touchstart", e => {
  startY = e.touches[0].clientY;
  startBottom = parseInt(editOverlay.style.bottom);
});

editOverlay.addEventListener("touchmove", e => {
  const diff = startY - e.touches[0].clientY;
  let newBottom = startBottom + diff;

  if (newBottom < -80) newBottom = -80;
  if (newBottom > window.innerHeight * 0.1) newBottom = window.innerHeight * 0.1;

  editOverlay.style.bottom = newBottom + "px";
});

// =========================
// 編集確定 → 履歴保存
// =========================
btnConfirmEdit.onclick = () => {
  const fixedText = editText.value.trim();
  if (!fixedText) {
    alert("テキストが空です。");
    return;
  }

  lastRawText = fixedText;
  saveHistoryEntry(lastPhotoBase64, lastRawText);

  closeEditOverlay();
  alert("履歴に保存しました。");
};

// キャンセル
btnCancelEdit.onclick = () => {
  closeEditOverlay();
};

// =========================
// 履歴保存
// =========================
function saveHistoryEntry(photo, text) {
  const history = JSON.parse(localStorage.getItem("receiptHistory_simple") || "[]");

  history.push({
    id: new Date().toLocaleString("ja-JP"),
    photo,
    rawText: text
  });

  localStorage.setItem("receiptHistory_simple", JSON.stringify(history));
}

// =========================
// 履歴表示
// =========================
btnShowHistory.onclick = () => {
  const history = JSON.parse(localStorage.getItem("receiptHistory_simple") || "[]");
  const container = document.getElementById("history");

  let html = "";
  history.forEach(h => {
    html += `
      <div class="history-item">
        <div style="font-size:12px;color:#666;">${h.id}</div>
        ${h.photo ? `<img src="${h.photo}">` : ""}
        <details style="margin-top:6px;">
          <summary>OCR全文</summary>
          <pre>${h.rawText}</pre>
        </details>
      </div>
    `;
  });

  container.innerHTML = html || "<p>履歴はまだありません。</p>";
};

// =========================
// ZIP作成
// =========================
btnDownloadZip.onclick = async () => {
  const history = JSON.parse(localStorage.getItem("receiptHistory_simple") || "[]");
  if (history.length === 0) {
    alert("履歴がありません");
    return;
  }

  const zip = new JSZip();

  history.forEach((h, idx) => {
    const folder = zip.folder(`${h.id.replace(/[\/:]/g, "-")}`);

    if (h.photo) {
      const base64 = h.photo.split(",")[1];
      folder.file("photo.jpg", base64, { base64: true });
    }

    folder.file("ocr.txt", h.rawText);
  });

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "receipts_ocr_only.zip";
  a.click();
};
