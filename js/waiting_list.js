document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loadingOverlay").style.display = "none";
  const SCRIPT_BASE_URL = "https://script.google.com/macros/s/AKfycbwOFUuxlwt90WSf_t4JHcJsWh8t7bmkcKddSkbvfVaeHayiNsgAE7lCdXHCd5wzP1zS9Q/exec";
  const qrResult = document.getElementById("qrResult");
  const qrRegionId = "reader";
  const html5QrCode = new Html5Qrcode(qrRegionId);

  function onScanSuccess(decodedText, decodedResult) {
    console.log(`✅ QRコードスキャン成功: ${decodedText}`);
    const qrResult = document.getElementById("qrResult");
    qrResult.value = decodedText;

    const parts = decodedText.split(",");
    if (parts.length === 7) {
      // Destructure in the correct order including guests
      const [room, checkIn, checkOut, guests, reservation, breakfastFlag, hashFromQR] = parts;
      generateHash({ room, checkIn, checkOut, guests, reservation, breakfastFlag }).then(calculatedHash => {
        if (calculatedHash === hashFromQR) {
          // 추가: 예약번호 서버 확인
          const loading = document.getElementById("loadingOverlay");
          if (loading) loading.style.display = "flex";
          fetch(`${SCRIPT_BASE_URL}?verifyReservation=${reservation}&callback=verifyCallback`)
            .then(response => response.text())
            .then(text => {
              const loading = document.getElementById("loadingOverlay");
              if (loading) loading.style.display = "none";
              const jsonText = text.replace(/^.*?\(/, "").replace(/\);?$/, "");
              const result = JSON.parse(jsonText);
              if (result.success && result.exists) {
                if (breakfastFlag === "1") {
                  window.currentRoomText = room;
                  window.maxGuestsFromQR = parseInt(guests);
                  document.getElementById("customPromptOverlay").style.display = "flex";
                } else {
                  alert(`${room}号はRoom Onlyプランです`);
                }
              } else {
                console.warn("❌ 예약번호がシートにない、またはハッシュ不一致");
                alert("すみません、フロントでご確認ください。");
              }
            })
            .catch(err => {
              const loading = document.getElementById("loadingOverlay");
              if (loading) loading.style.display = "none";
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

  async function generateHash({ room, checkIn, checkOut, reservation, breakfastFlag }) {
    const secret = "HOTEL_ONLY_SECRET_KEY";
    // Include guests in the hash input
    const data = `${room},${checkIn},${checkOut},${reservation},${breakfastFlag}`;
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
      const parts = text.substring(1).split(",");
      const command = parts[0];
      const room = parts[1];
      const guests = parts[2] || null;

      const listContainer = document.getElementById("List");
      const existingButton = Array.from(listContainer.children).find(btn =>
        btn.textContent.startsWith(`${room}号`)
      );

      if (command === "1") {
        if (!room || !guests) {
          alert("追加するには部屋番号と人数が必要です（例: #1,501,2）");
          return;
        }

        if (existingButton) {
          existingButton.textContent = `${room}号 ${guests}名`;
        } else {
          const button = document.createElement("button");
          button.classList.add("dynamic-button");
          button.textContent = `${room}号 ${guests}名`;
          button.onclick = () => {
            alert(`"${room}" (${guests}名) ボタンがクリックされました`);
          };
          listContainer.appendChild(button);
        }

        logDebug(`🟢 ${room}号 ${guests}名 を大気リストに追加または更新`);
      } else if (command === "2") {
        if (!room) {
          alert("キャンセルには部屋番号が必要です（例: #2,501）");
          return;
        }

        if (existingButton) {
          listContainer.removeChild(existingButton);
          logDebug(`🗑️ ${room}号 を大気リストから削除`);
        } else {
          alert(`${room}号 は大気リストに存在しません`);
        }
      } else {
        alert("不明なコマンドです。#1 または #2 を使用してください。");
      }

      document.getElementById("qrResult").value = "";
      return;
    }

    const parts = text.split(",");
    if (parts.length === 7) {
      // Destructure in the correct order including guests
      const [room, checkIn, checkOut, guests, reservation, breakfastFlag, hashFromQR] = parts;
      generateHash({ room, checkIn, checkOut, reservation, breakfastFlag }).then(calculatedHash => {
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
    if (window.maxGuestsFromQR && parseInt(guests) > window.maxGuestsFromQR) {
      alert(`最大人数は${window.maxGuestsFromQR}名です。`);
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

    // --- localStorage에 저장 ---
    const localData = JSON.parse(localStorage.getItem("waitingList") || "[]");
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const formattedTime = `${yyyy}-${mm}-${dd} ${hh}:${min}`;

    const newData = `${text},${parseInt(guests)},${formattedTime}`;

    // 기존 항목이 있다면 업데이트
    const index = localData.findIndex(entry => entry.startsWith(`${text},`));
    if (index !== -1) {
      localData[index] = newData;
    } else {
      localData.push(newData);
    }

    localStorage.setItem("waitingList", JSON.stringify(localData));

    document.getElementById("qrResult").value = "";
    document.getElementById("guestCountInput").value = "";
    document.getElementById("customPromptOverlay").style.display = "none";
  };

  window.closeCustomPrompt = function() {
    document.getElementById("customPromptOverlay").style.display = "none";
    document.getElementById("guestCountInput").value = "";
  };
});