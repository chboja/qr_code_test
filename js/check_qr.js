// --- Custom Alert Helper ---
function showCustomAlert(message) {
  const overlay = document.createElement("div");
  overlay.className = "custom-alert-overlay";
  overlay.innerHTML = `
    <div class="custom-alert-box">
      <p>${message.replace(/\n/g, "<br>")}</p>
      <button id="customAlertClose">OK</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("customAlertClose").onclick = () => {
    overlay.remove();
  };

  setTimeout(() => {
    if (document.body.contains(overlay)) overlay.remove();
  }, 3000);
}

// --- Duplicate scan guard variables ---
let lastScannedText = "";
let lastScannedTime = 0;

async function generateHash({ room, checkIn, checkOut, guests, reservation, breakfastFlag }) {
  const secret = "HOTEL_ONLY_SECRET_KEY";
  const data = `${room},${checkIn},${checkOut},${guests},${reservation},${breakfastFlag}`;
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data + secret));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

document.addEventListener("DOMContentLoaded", () => {
  // --- Preload reservation list ---
  const SCRIPT_BASE_URL = "https://script.google.com/macros/s/AKfycbwApxm8xTJ_wRU78n0mXT6jaO4Dv7mKHAxOKuWyQIIYyLcW4nrjShnOZJnn8KcSN-xBag/exec";
  let reservationSet = new Set();

  function preloadReservationList() {
    const callback = "handleReservationList";
    const query = `mode=reservationList&callback=${callback}`;
    const script = document.createElement("script");
    script.src = `${SCRIPT_BASE_URL}?${query}`;
    document.body.appendChild(script);
  }

  window.handleReservationList = function(response) {
    if (response.success && Array.isArray(response.reservations)) {
      reservationSet = new Set(response.reservations);
      console.log("📥 예약번호 리스트 로컬에 저장됨:", reservationSet);
    } else {
      console.warn("⚠️ 예약번호 리스트 불러오기 실패");
    }
  };

  preloadReservationList();
  const qrRegionId = "preview";
  const html5QrCode = new Html5Qrcode(qrRegionId);


  // Shared QR processing logic for both scan and button click
  function handleQrProcessing(decodedText) {
    const parts = decodedText.split(',');
    if (parts.length !== 7) {
      showCustomAlert("QRコードの形式が正しくありません。");
      return;
    }

    const [room, checkIn, checkOut, guests, reservation, breakfastFlag, hashFromQR] = parts;
    generateHash({ room, checkIn, checkOut, guests, reservation, breakfastFlag }).then(calculatedHash => {
      if (calculatedHash !== hashFromQR) {
        showCustomAlert("❌ QRコードが不正です。");
        return;
      }

      const isValidReservation = reservationSet.has(reservation.toLowerCase().split(/[-_]/)[0]);
      if (!isValidReservation) {
        showCustomAlert("⚠️ QRコードの情報が変更された可能性があります。フロントでご確認ください。");
        return;
      }

      window.currentRoomText = room;
      document.getElementById("guestCountInput").value = guests;
      document.getElementById("customPromptOverlay").style.display = "flex";
      const promptLabel = document.getElementById("customPromptLabel");
      if (promptLabel) {
        promptLabel.innerText = "人数入力";
      }
      const cancelBtn = document.getElementById("customPromptCancel");
      const confirmBtn = document.getElementById("customPromptConfirm");
      if (cancelBtn) cancelBtn.innerHTML = "キャンセル";
      if (confirmBtn) confirmBtn.innerHTML = "確定";
    });
  }

  function onScanSuccess(decodedText, decodedResult) {
    const now = Date.now();
    if (decodedText === lastScannedText && now - lastScannedTime < 5000) return;
    lastScannedText = decodedText;
    lastScannedTime = now;
    // qrResult.value = decodedText;
    handleQrProcessing(decodedText);
    // html5QrCode.stop().catch(err => console.error("Failed to stop scanner:", err));
  }

  Html5Qrcode.getCameras().then(devices => {
    if (devices && devices.length > 0) {
      const backCamera = devices.find(device =>
        device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
      ) || devices[devices.length - 1];

      html5QrCode.start(
        { deviceId: { exact: backCamera.id } },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess
      ).catch(err => {
        console.error("Camera start error:", err);
        qrResult.value = "カメラの起動に失敗しました。";
      });
    } else {
      qrResult.value = "カメラが見つかりませんでした。";
    }
  }).catch(err => {
    console.error("Camera access error:", err);
    qrResult.value = "カメラへのアクセスに失敗しました。";
  });

  // --- Reusable QR scanner restart function ---
  function restartQrScanner() {
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length > 0) {
        const backCamera = devices.find(device =>
          device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
        ) || devices[devices.length - 1];

        html5QrCode.start(
          { deviceId: { exact: backCamera.id } },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          onScanSuccess
        ).catch(err => {
          console.error("カメラ再起動エラー:", err);
        });
      }
    });
  }

  // --- Reinitialize camera on page visibility change ---
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      html5QrCode.stop().then(() => {
        console.log("✅ カメラセッション停止完了");
        restartQrScanner();
      }).catch(err => {
        console.warn("⚠️ カメラ停止失敗またはすでに停止済み", err);
        restartQrScanner();
      });
    }
  });

  // const qrResult = document.getElementById("qrResult");
  // const searchButton = document.getElementById("searchButton");
  // if (searchButton) {
  //   searchButton.addEventListener("click", () => {
  //     const qrText = qrResult.value.trim();
  //     if (!qrText) {
  //       alert("QRコードが読み取られていません。");
  //       return;
  //     }
  //     handleQrProcessing(qrText);
  //   });
  // }

  const overlay = document.createElement("div");
  overlay.id = "loadingOverlay";
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.4)";
  overlay.style.display = "none";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = 9999;
  overlay.innerHTML = '<div style="color: white; font-size: 24px;">検索中…</div>';
  document.body.appendChild(overlay);
});

window.handleVerifyResponse = function(response) {
  document.getElementById("loadingOverlay").style.display = "none";
  if (!response.success) {
    showCustomAlert("⚠️QRコードの情報が変更された可能性があります。フロントでご確認ください。⚠️");
  } else if (response.match === true) {
    const breakfastFlag = Number(response.breakfastFlag);
    if (breakfastFlag === 0) {
      showCustomAlert("Room Onlyの部屋です。");
    } else if (breakfastFlag === 1) {
      showCustomAlert("朝食付き部屋です。");
    } else {
      showCustomAlert("✅ QRコードがデータベースと一致しました。");
    }
  } else {
    showCustomAlert("⚠️QRコードの情報が変更された可能性があります。フロントでご確認ください。");
  }
};

// --- Guest count modal button handlers ---
// Move these event listeners inside DOMContentLoaded to ensure elements exist
document.addEventListener("DOMContentLoaded", () => {
  const inputEl = document.getElementById("guestCountInput");
  const decreaseBtn = document.getElementById("decreaseGuestBtn");
  const increaseBtn = document.getElementById("increaseGuestBtn");
  if (decreaseBtn && inputEl) {
    decreaseBtn.onclick = () => {
      let val = parseInt(inputEl.value) || 1;
      if (val > 1) inputEl.value = val - 1;
    };
  }
  if (increaseBtn && inputEl) {
    increaseBtn.onclick = () => {
      let val = parseInt(inputEl.value) || 1;
      inputEl.value = val + 1;
    };
  }
  const customPromptCancel = document.getElementById("customPromptCancel");
  if (customPromptCancel && inputEl) {
    customPromptCancel.onclick = () => {
      document.getElementById("customPromptOverlay").style.display = "none";
      inputEl.value = "1";
    };
  }
});