document.addEventListener("DOMContentLoaded", () => {
  const qrResult = document.getElementById("qrResult");
  const qrRegionId = "reader";
  const html5QrCode = new Html5Qrcode(qrRegionId);

  function onScanSuccess(decodedText, decodedResult) {
    console.log(`✅ QRコードスキャン成功: ${decodedText}`);
    const qrResult = document.getElementById("qrResult");
    qrResult.value = decodedText;
    html5QrCode.stop().catch(err => console.error("Failed to stop scanner:", err));

    const parts = decodedText.split(",");
    if (parts.length === 6) {
      const [room, checkIn, checkOut, guests, reservation, hashFromQR] = parts;
      generateHash({ room, checkIn, checkOut, reservation }).then(calculatedHash => {
        if (calculatedHash === hashFromQR) {
          // 추가: 예약번호 서버 확인
          fetch(`https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?verifyReservation=${reservation}&hashcode=${hashFromQR}&callback=verifyCallback`)
            .then(response => response.text())
            .then(text => {
              const jsonText = text.replace(/^.*?\(/, "").replace(/\);?$/, "");
              const result = JSON.parse(jsonText);
              if (result.success && result.exists) {
                console.log("✅ 예약번호 및 해시 서버 검증 통과 → 검색 실행");
                window.currentRoomText = room;  // 방 번호만 currentRoomText에 저장
                document.getElementById("customPromptOverlay").style.display = "flex"; // 인원 입력창 바로 표시
              } else {
                console.warn("❌ 예약번호がシートにない、またはハッシュ不一致");
                alert("すみません、フロントでご確認ください。");
              }
            })
            .catch(err => {
              console.error("🔴 예약번호 확인 중 오류 발생", err);
              alert("予約番号の確認中にエラーが発生しました。");
            });
          // END 추가
        } else {
          console.warn("🔴 QRコードのハッシュが一致しません（無効なQR）");
          alert("QRコードが無効です。");
        }
      });
    } else {
      console.warn("🔴 QRコード形式が正しくありません");
    }
  }

  async function generateHash({ room, checkIn, checkOut, reservation }) {
    const secret = "HOTEL_ONLY_SECRET_KEY";
    const data = `${room},${checkIn},${checkOut},${reservation}`;
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data + secret));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
    // (아래에 아무것도 변경하지 않음)
  }

  Html5Qrcode.getCameras().then(devices => {
    if (devices && devices.length > 0) {
      html5QrCode.start(
        { facingMode: "user" },
        {
          fps: 10,
          qrbox: function(viewfinderWidth, viewfinderHeight) {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.floor(minEdge * 0.7);
            return { width: boxSize, height: boxSize };
          }
        },
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

  let count = 1;

  // Debug log 출력용
  function logDebug(msg) {
    const logBox = document.getElementById("debugLog");
    if (logBox) {
      const time = new Date().toLocaleTimeString();
      const entry = document.createElement("div");
      entry.textContent = `[${time}] ${msg}`;
      logBox.prepend(entry);
    }
  }

  const submitBtn = document.getElementById("searchButton");
  submitBtn.addEventListener("click", () => {
    const text = document.getElementById("qrResult").value.trim();
    if (!text) {
      alert("QRコードをスキャンしてください。");
      return;
    }

    if (text.startsWith("#")) {
      logDebug("✅ '#'로 시작하는 수동 명령어 입력됨 → 검색 허용");
      window.currentRoomText = text;
      document.getElementById("customPromptOverlay").style.display = "flex";
      return;
    }

    const parts = text.split(",");
    if (parts.length === 6) {
      const [room, checkIn, checkOut, guests, reservation, hashFromQR] = parts;
      generateHash({ room, checkIn, checkOut, reservation }).then(calculatedHash => {
        if (calculatedHash === hashFromQR) {
          logDebug("🟢 QR코드 형식 및 해시 일치 → 검색 실행");
          window.currentRoomText = text;
          document.getElementById("customPromptOverlay").style.display = "flex";
        } else {
          logDebug("❌ QR코드 해시 불일치 → 검색 차단");
          alert("QRコードが無効です。");
        }
      });
    } else {
      logDebug("⚠️ QR코드 형식 아님 → 검색 차단");
      alert("QRコードの形式が正しくありません。");
    }
  });

  // ✅ Enter, Return, Go, Done, Next 키 입력 시 검색 버튼 클릭 실행 (iPad/iOS 키보드 대응)
  document.addEventListener("keydown", (e) => {
    console.log("Pressed key:", e.key); // 콘솔에 키 출력
    if (
      ["Enter", "Return", "Go", "Done", "Next"].includes(e.key) &&
      document.activeElement?.id === "qrResult"
    ) {
      console.log("🔍 検索ボタンを実行します");
      e.preventDefault();
      document.getElementById("searchButton").click();
    }
  });

  // ✅ 입력 외의 영역을 터치하면 키보드 닫기
  document.addEventListener("touchstart", (e) => {
    const active = document.activeElement;
    if (
      active &&
      (active.tagName === "INPUT" || active.tagName === "TEXTAREA") &&
      !e.target.closest("input") &&
      !e.target.closest("textarea")
    ) { 
      // Delay blur slightly to ensure compatibility with iPadOS event processing
      setTimeout(() => {
        active.blur();
      }, 50);
    }
  });

  // ✅ 입력 필드 포커스/포커스아웃 시 스크롤 제어 개선
  let lastScrollY = 0;

  document.addEventListener("focusin", () => {
    lastScrollY = window.scrollY;
  });

  document.addEventListener("focusout", () => {
    setTimeout(() => {
      // 키보드 내려간 뒤에도 수동 스크롤한 적 없으면 복원
      if (window.scrollY > lastScrollY + 50) return; // 사용자가 직접 내린 경우 건드리지 않음
      window.scrollTo({ top: lastScrollY, behavior: "smooth" });
    }, 200);
  });
  // --- Helper functions for custom guest count modal ---
  window.submitGuestCount = function() {
    const guests = document.getElementById("guestCountInput").value;
    if (!guests) {
      alert("人数を入力してください。");
      return;
    }

    const text = window.currentRoomText || "";
    const button = document.createElement("button");
    button.classList.add("dynamic-button");
    button.textContent = `${text}号 ${guests}名`;
    button.onclick = () => {
      alert(`"${text}" (${guests}名) ボタンがクリックされました`);
    };

    const listContainer = document.getElementById("List");
    listContainer.appendChild(button);

    document.getElementById("qrResult").value = "";
    document.getElementById("guestCountInput").value = "";
    document.getElementById("customPromptOverlay").style.display = "none";
  };

  window.closeCustomPrompt = function() {
    document.getElementById("customPromptOverlay").style.display = "none";
    document.getElementById("guestCountInput").value = "";
  };
});