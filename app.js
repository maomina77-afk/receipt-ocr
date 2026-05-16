// =========================
// グローバル状態
// =========================
let GOOGLE_API_KEY = localStorage.getItem("GOOGLE_API_KEY") || "";
let lastRawText = "";
let lastPhotoBase64 = "";

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

const btnSetApiKey = document.getElementById("setApiKey");
const btnStart = document.getElementById("start");
const btnCapture = document.getElementById("capture");
const btnLoadFile = document.getElementById("loadFile");
const btnShowHistory = document.getElementById("showHistory");
const btnDownloadZip = document.getElementById("downloadZip");

const editOverlay = document.getElementById("editOverlay");
const editText = document.getElementById("editText");
const btnConfirmEdit = document.getElementById("confirmEdit");
const btnCancelEdit = document.getElementById("cancelEdit");

// =========================
// 簡易ビープ音
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
    if (btnCapture) {
      btnCapture.style.backgroundColor = busyColor;
      btnCapture.textContent = "OCR中…";
      btnCapture.disabled = true;
    }
    if (btnLoadFile) {
      btnLoadFile.style.backgroundColor = busyColor;
      btnLoadFile.textContent = "OCR中…";
      btnLoadFile.disabled = true;
    }
  } else {
    if (btnCapture) {
      btnCapture.style.backgroundColor = normalColor;
      btnCapture.textContent = "撮影してOCR";
      btnCapture.disabled = false;
    }
    if (btnLoadFile) {
      btnLoadFile.style.backgroundColor = "#555";
      btnLoadFile.textContent = "画像ファイルをOCR";
      btnLoadFile.disabled = false;
    }
  }
}

// =========================
// APIキー
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
// カメラ起動
// =========================
btnStart.onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    video.srcObject = stream;
  } catch (e) {
    alert("カメラが使えません: " + e.message);
  }
};

// =========================
// 撮影→OCR
// =========================
btnCapture.onclick = async () => {
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

  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  const base64 = dataUrl.split(",")[1];
  lastPhotoBase64 = dataUrl;

  await ocrBase64(base64);
};

// =========================
// ファイル→OCR
// =========================
btnLoadFile.onclick = async () => {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return alert("ファイルを選択してください");

  const ext = file.name.split(".").pop().toLowerCase();
  if (!["jpg","jpeg","png"].includes(ext)) {
    alert("今は画像ファイル(jpg/png)のみ対応にしています。");
    return;
  }

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
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      const base64 = dataUrl.split(",")[1];
      lastPhotoBase64 = dataUrl;
      await ocrBase64(base64);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

// =========================
// OCR共通
// =========================
async function ocrBase64(base64) {
  if (!GOOGLE_API_KEY) {
    alert("先にAPIキーを設定してください");
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
      console.log("Vision API response:", data);
      alert("OCRに失敗しました。明るい場所で、レシートを画面いっぱいに撮影してください。");
      lastRawText = "";
      beep(false);
      setOcrBusy(false);
      return;
    }

    let text = data.responses[0].fullTextAnnotation.text || "";
    text = normalizeOcrText(text);
    lastRawText = text;

    // 編集ウインドウに表示
    openEditOverlay(text);
    beep(true);
  } catch (e) {
    console.error(e);
    alert("通信エラーが発生しました: " + e.message);
    beep(false);
  } finally {
    setOcrBusy(false);
  }
}

// =========================
// OCR誤字の軽い補正
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
// 編集スライドウインドウ制御
// =========================
function openEditOverlay(text) {
  editText.value = text || "";
  editOverlay.style.bottom = "0px";
}

function closeEditOverlay() {
  editOverlay.style.bottom = "-80vh";
}

// 確定して履歴に保存
btnConfirmEdit.onclick = () => {
  const fixedText = editText.value || "";
  if (!fixedText.trim()) {
    alert("テキストが空です。");
    return;
  }
  lastRawText = fixedText;
  saveHistoryEntry(lastPhotoBase64, lastRawText);
  closeEditOverlay();
  alert("写真＋OCR全文を履歴に保存しました。");
};

// キャンセル
btnCancelEdit.onclick = () => {
  closeEditOverlay();
};

// =========================
// 履歴保存・表示
// =========================
function saveHistoryEntry(photoDataUrl, rawText) {
  const history = JSON.parse(localStorage.getItem("receiptHistory_simple") || "[]");
  history.push({
    id: new Date().toISOString(),
    photo: photoDataUrl || "",
    rawText: rawText || ""
  });
  localStorage.setItem("receiptHistory_simple", JSON.stringify(history));
}

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
          <pre>${h.rawText || ""}</pre>
        </details>
      </div>
    `;
  });
  container.innerHTML = html || "<p>履歴はまだありません。</p>";
};

// =========================
// ZIP作成（写真＋OCR全文）
// =========================
btnDownloadZip.onclick = async () => {
  const history = JSON.parse(localStorage.getItem("receiptHistory_simple") || "[]");
  if (history.length === 0) {
    alert("履歴がありません");
    return;
  }

  const zip = new JSZip();

  history.forEach((h, idx) => {
    const dateKey = h.id ? h.id.substring(0, 10) : "unknown";
    const folder = zip.folder(`${dateKey}/receipt_${idx + 1}`);

    if (h.photo) {
      const base64 = h.photo.split(",")[1];
      folder.file("photo.jpg", base64, { base64: true });
    }
    folder.file("ocr.txt", h.rawText || "");
  });

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "receipts_ocr_only.zip";
  a.click();
};
