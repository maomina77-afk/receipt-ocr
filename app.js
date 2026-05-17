// =========================
// グローバル状態
// =========================
let GOOGLE_API_KEY = localStorage.getItem("GOOGLE_API_KEY") || "";
let lastRawText = "";
let lastPhotoBase64 = "";
let cropper = null;
let currentStream = null;
let currentTrack = null;

// 会社名の記憶
let savedCompany = localStorage.getItem("companyName") || "";

// DOM取得
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

const zoomAreaCamera = document.getElementById("zoomAreaCamera");
const zoomSliderCamera = document.getElementById("zoomSliderCamera");
const zoomLabelCamera = document.getElementById("zoomLabelCamera");

const zoomAreaPreview = document.getElementById("zoomAreaPreview");
const zoomSliderPreview = document.getElementById("zoomSliderPreview");
const zoomLabelPreview = document.getElementById("zoomLabelPreview");

const btnSetApiKey = document.getElementById("setApiKey");
const btnStart = document.getElementById("start");
const btnCapture = document.getElementById("capture");
const btnLoadFile = document.getElementById("loadFile");
const btnShowHistory = document.getElementById("showHistory");
const btnDownloadZip = document.getElementById("downloadZip");

const fileInput = document.getElementById("fileInput");

const previewArea = document.getElementById("previewArea");
const previewContainer = document.getElementById("previewContainer");
const previewImage = document.getElementById("previewImage");
const btnDoCrop = document.getElementById("doCrop");
const btnCancelPreview = document.getElementById("cancelPreview");

const editOverlay = document.getElementById("editOverlay");
const editText = document.getElementById("editText");
const fileNameInput = document.getElementById("fileNameInput");
const companyInput = document.getElementById("companyInput");
const btnConfirmEdit = document.getElementById("confirmEdit");
const btnCancelEdit = document.getElementById("cancelEdit");

const historySearch = document.getElementById("historySearch");
const historySort = document.getElementById("historySort");

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
// デフォルトファイル名生成
// =========================
function generateDefaultFileName(company) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}_${company || "会社名"}`;
}

// =========================
// カメラ起動（ズーム＋ピンチ）
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
    currentTrack = currentStream.getVideoTracks()[0];
    const capabilities = currentTrack.getCapabilities();

    if (capabilities.zoom) {
      zoomAreaCamera.style.visibility = "visible";
      zoomAreaCamera.style.opacity = "1";
      zoomAreaCamera.style.pointerEvents = "auto";

      zoomSliderCamera.min = capabilities.zoom.min;
      zoomSliderCamera.max = capabilities.zoom.max;
      zoomSliderCamera.step = capabilities.zoom.step || 0.1;

      const initialZoom = Math.min(
        capabilities.zoom.max,
        Math.max(capabilities.zoom.min, 1.2)
      );
      zoomSliderCamera.value = initialZoom;
      zoomLabelCamera.textContent = initialZoom.toFixed(1) + "x";

      currentTrack.applyConstraints({ advanced: [{ zoom: initialZoom }] });

      zoomSliderCamera.oninput = () => {
        const z = Number(zoomSliderCamera.value);
        zoomLabelCamera.textContent = z.toFixed(1) + "x";
        currentTrack.applyConstraints({ advanced: [{ zoom: z }] });
      };

      let lastDistance = null;
      video.addEventListener("touchmove", e => {
        if (e.touches.length === 2 && currentTrack) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (lastDistance) {
            const diff = distance - lastDistance;
            let newZoom = Number(zoomSliderCamera.value) + diff * 0.005;
            newZoom = Math.max(capabilities.zoom.min, Math.min(capabilities.zoom.max, newZoom));
            zoomSliderCamera.value = newZoom;
            zoomLabelCamera.textContent = newZoom.toFixed(1) + "x";
            currentTrack.applyConstraints({ advanced: [{ zoom: newZoom }] });
          }
          lastDistance = distance;
        }
      });
      video.addEventListener("touchend", () => {
        lastDistance = null;
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
  zoomAreaCamera.style.visibility = "hidden";
  zoomAreaCamera.style.opacity = "0";
  zoomAreaCamera.style.pointerEvents = "none";

  if (video.readyState < 2 || video.videoWidth === 0) {
    alert("カメラ準備中です。1〜2秒待ってからもう一度撮影してください。");
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  lastPhotoBase64 = dataUrl;

  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
    currentTrack = null;
  }

  previewImage.onload = () => {
    previewArea.style.display = "block";

    if (cropper) cropper.destroy();
    cropper = new Cropper(previewImage, {
      viewMode: 1,
      dragMode: "move",
      background: false,
      autoCropArea: 1.0,
      movable: true,
      zoomable: true,
      scalable: false,
      rotatable: false,
      cropBoxMovable: true,
      cropBoxResizable: true
    });

    zoomAreaPreview.style.visibility = "visible";
    zoomAreaPreview.style.opacity = "1";
    zoomAreaPreview.style.pointerEvents = "auto";

    zoomSliderPreview.value = zoomSliderCamera.value;
    zoomLabelPreview.textContent = zoomSliderCamera.value + "x";
  };

  previewImage.src = dataUrl;
};

// =========================
// プレビュー → OCR
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
  zoomAreaPreview.style.visibility = "hidden";
  zoomAreaPreview.style.opacity = "0";
  zoomAreaPreview.style.pointerEvents = "none";

  await ocrBase64(base64);
};

// =========================
// プレビューキャンセル
// =========================
btnCancelPreview.onclick = () => {
  previewArea.style.display = "none";

  zoomAreaPreview.style.visibility = "hidden";
  zoomAreaPreview.style.opacity = "0";
  zoomAreaPreview.style.pointerEvents = "none";

  if (cropper) cropper.destroy();
  cropper = null;
};

// =========================
// ファイルからOCR
// =========================
btnLoadFile.onclick = () => {
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("画像ファイルを選択してください");
    return;
  }
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    lastPhotoBase64 = dataUrl;
    const base64 = dataUrl.split(",")[1];
    ocrBase64(base64);
  };
  reader.readAsDataURL(file);
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

    // ★ 自動整形（誤字補正・数字揺れ補正）
    text = autoFixText(text);

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
// OCR誤字補正・自然整形
// =========================
function autoFixText(text) {
  return text
    .replace(/[O〇○]/g, "0")
    .replace(/[Iｌ｜]/g, "1")
    .replace(/問合せ/g, "問い合わせ")
    .replace(/御/g, "ご")
    .replace(/ +/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

// =========================
// 編集ボトムシート
// =========================
function openEditOverlay(text) {
  editText.value = text;

  companyInput.value = savedCompany;

  fileNameInput.value = generateDefaultFileName(savedCompany);

  editOverlay.style.bottom = "0px";
}

function closeEditOverlay() {
  editOverlay.style.bottom = "-80vh";
}

// =========================
// 編集内容を保存
// =========================
btnConfirmEdit.onclick = () => {
  const fixedText = editText.value.trim();
  const fileName = fileNameInput.value.trim();
  const company = companyInput.value.trim();

  if (!fixedText) {
    alert("テキストが空です。");
    return;
  }
  if (!fileName) {
    alert("ファイル名を入力してください。");
    return;
  }

  savedCompany = company;
  localStorage.setItem("companyName", company);

  lastRawText = fixedText;

  saveHistoryEntry(lastPhotoBase64, lastRawText, fileName, company);

  closeEditOverlay();
  alert("履歴に保存しました。");
};

btnCancelEdit.onclick = () => {
  closeEditOverlay();
};

// =========================
// 履歴保存
// =========================
function saveHistoryEntry(photo, text, fileName, company) {
  const history = JSON.parse(localStorage.getItem("receiptHistory_simple") || "[]");

  history.push({
    id: new Date().toLocaleString("ja-JP"),
    photo,
    rawText: text,
    fileName,
    company
  });

  localStorage.setItem("receiptHistory_simple", JSON.stringify(history));
}
// =========================
// 履歴表示（検索・ソート対応）
// =========================
btnShowHistory.onclick = () => {
  renderHistory();
};

// 履歴の描画
function renderHistory() {
  let history = JSON.parse(localStorage.getItem("receiptHistory_simple") || "[]");

  // 検索
  const keyword = historySearch.value.trim();
  if (keyword) {
    history = history.filter(h =>
      h.fileName.includes(keyword) ||
      h.company.includes(keyword) ||
      h.rawText.includes(keyword) ||
      h.id.includes(keyword)
    );
  }

  // ソート
  history = sortHistory(history, historySort.value);

  // 描画
  const container = document.getElementById("history");
  let html = "";

  history.forEach(h => {
    html += `
      <div class="history-item">
        <div style="font-size:12px;color:#666;">${h.id}</div>
        <div><b>${h.fileName}</b>（${h.company}）</div>
        ${h.photo ? `<img src="${h.photo}">` : ""}
        <details style="margin-top:6px;">
          <summary>OCR全文</summary>
          <pre>${h.rawText}</pre>
        </details>
      </div>
    `;
  });

  container.innerHTML = html || "<p>履歴はまだありません。</p>";
}

// =========================
// 履歴ソート
// =========================
function sortHistory(history, mode) {
  switch (mode) {
    case "date_desc":
      return history.sort((a, b) => new Date(b.id) - new Date(a.id));
    case "date_asc":
      return history.sort((a, b) => new Date(a.id) - new Date(b.id));
    case "name":
      return history.sort((a, b) => a.fileName.localeCompare(b.fileName));
    case "company":
      return history.sort((a, b) => a.company.localeCompare(b.company));
    default:
      return history;
  }
}

// =========================
// ZIP作成（フォルダなし・重複名は自動採番）
// =========================
btnDownloadZip.onclick = async () => {
  const history = JSON.parse(localStorage.getItem("receiptHistory_simple") || "[]");
  if (history.length === 0) {
    alert("履歴がありません");
    return;
  }

  const zip = new JSZip();
  const usedNames = new Set();

  history.forEach(h => {
    let base = h.fileName || "noname";
    let unique = getUniqueName(base, usedNames);

    // 画像
    if (h.photo) {
      const base64 = h.photo.split(",")[1];
      zip.file(`${unique}.jpg`, base64, { base64: true });
    }

    // OCRテキスト
    zip.file(`${unique}.txt`, h.rawText);
  });

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "receipts_ocr.zip";
  a.click();
};

// 重複名の自動採番
function getUniqueName(base, used) {
  let name = base;
  let i = 1;
  while (used.has(name)) {
    name = `${base}(${i})`;
    i++;
  }
  used.add(name);
  return name;
}

// =========================
// 履歴バックアップ（JSON）
// =========================
document.getElementById("backupHistory").onclick = () => {
  const history = localStorage.getItem("receiptHistory_simple") || "[]";

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  const blob = new Blob([history], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `receipt_history_backup_${y}${m}${d}.json`;
  a.click();
};

// =========================
// 履歴復元（JSON）
// =========================
document.getElementById("restoreHistory").onclick = () => {
  const fileInput = document.getElementById("restoreFileInput");
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("復元する JSON ファイルを選択してください");
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = e => {
    try {
      const json = JSON.parse(e.target.result);

      if (!Array.isArray(json)) {
        alert("JSON の形式が正しくありません");
        return;
      }

      // ★ 履歴を上書き保存
      localStorage.setItem("receiptHistory_simple", JSON.stringify(json));

      alert("履歴を復元しました");
      renderHistory();

    } catch (err) {
      alert("JSON の読み込みに失敗しました: " + err.message);
    }
  };

  reader.readAsText(file);
};

// =========================
// 検索・ソートのリアルタイム反映
// =========================
historySearch.oninput = () => renderHistory();
historySort.onchange = () => renderHistory();
