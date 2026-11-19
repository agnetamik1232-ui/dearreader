// Dear Reader — reading a book's barcode with the camera.
// Android Chrome has a built-in barcode reader; iPhone uses the bundled ZXing library (vendor/zxing.min.js, Apache 2.0).
import { validISBN, cleanISBN } from "./books.js";

let zxingLoading = null;
function loadZXing() {
  if (window.ZXing) return Promise.resolve();
  if (!zxingLoading) zxingLoading = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "vendor/zxing.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  return zxingLoading;
}

export const canScan = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

// Starts the camera in <video> and calls onCode(isbn) once a book barcode is read. Returns stop().
export async function startScan(video, onCode) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  let stopped = false, reader = null;
  const stop = () => { stopped = true; try { reader && reader.reset(); } catch { /* ignore */ } stream.getTracks().forEach(t => t.stop()); video.srcObject = null; };
  const done = code => { if (stopped) return; const c = cleanISBN(code); if (validISBN(c) && /^97[89]/.test(c)) { stop(); onCode(c); return true; } return false; };
  video.setAttribute("playsinline", ""); video.muted = true; video.srcObject = stream;
  await video.play().catch(() => {});
  if ("BarcodeDetector" in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes("ean_13")) {
        const det = new window.BarcodeDetector({ formats: ["ean_13"] });
        const loop = async () => {
          if (stopped) return;
          try { for (const c of await det.detect(video)) if (done(c.rawValue)) return; } catch { /* frame not ready */ }
          setTimeout(loop, 180);
        };
        loop();
        return stop;
      }
    } catch { /* fall back to ZXing */ }
  }
  await loadZXing();
  const Z = window.ZXing;
  const hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  reader = new Z.BrowserMultiFormatReader(hints, 250);
  reader.decodeFromVideoElementContinuously(video, res => { if (res) done(res.getText()); });
  return stop;
}
