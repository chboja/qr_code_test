const SCRIPT_BASE_URL = "https://script.google.com/macros/s/AKfycbzqC05DHC4AiZc1dTDDxy1yKkgfJN1nMrDZVj9cMitOYB8jz8erPhI5QfZw8K_TxU6QNw/exec";
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loadingOverlay").style.display = "none";
  const savedList = JSON.parse(localStorage.getItem("waitingList") || "[]");
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  // Remove entries not from today and not between 06:00 and 10:59
  const todayList = savedList.filter(entry => {
    const timestamp = entry.split(",")[2];
    const date = timestamp.slice(0, 10);
    const hour = parseInt(timestamp.slice(11, 13));
    return date === today && hour >= 6 && hour < 11;
  });
  localStorage.setItem("waitingList", JSON.stringify(todayList));
  const listContainer = document.getElementById("List");

  const waitingList = todayList.filter(entry => {
    const parts = entry.split(",");
    const [room, guests, timestamp, status] = parts;
    const entryDate = timestamp.slice(0, 10);
    const entryHour = parseInt(timestamp.slice(11, 13));
    return (
      status === "0" &&
      entryDate === today &&
      entryHour >= 6 &&
      entryHour < 11
    );
  });

  waitingList.sort((a, b) => {
    const timeA = new Date(a.split(",")[2]);
    const timeB = new Date(b.split(",")[2]);
    return timeA - timeB;
  });

  waitingList.forEach(entry => {
    const [room, guests, timestamp] = entry.split(",");
    const button = document.createElement("button");
    button.classList.add("dynamic-button");
    button.textContent = `${room}号 ${guests}名`;
    button.onclick = () => {
      const localData = JSON.parse(localStorage.getItem("waitingList") || "[]");
      const index = localData.findIndex(entry => entry.split(",")[0] === room);
      if (index !== -1) {
        const [roomNum, guests, timestamp] = localData[index].split(",");
        const updatedEntry = `${roomNum},${guests},${timestamp},1`;
        localData[index] = updatedEntry;
        localStorage.setItem("waitingList", JSON.stringify(localData));

        // Send to Google Apps Script via JSONP
        const jsonpScript = document.createElement("script");
        jsonpScript.src = `${SCRIPT_BASE_URL}?callback=handlePostResponse`
          + `&room=${encodeURIComponent(roomNum)}`
          + `&guests=${encodeURIComponent(guests)}`
          + `&timestamp=${encodeURIComponent(timestamp)}`;
        document.body.appendChild(jsonpScript);
      }
    };
    listContainer.appendChild(button);
  });

  // const SCRIPT_BASE_URL = "https://script.google.com/macros/s/AKfycbx2QKA2TI6_7Js9jNw1H5E0g12HNeXRSQSX8YCAL5MGHadyHlZF4cw0zyZiZ6DYgCwupQ/exec";
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
      // Only pass the required fields (excluding guests) to generateHash
      generateHash({ room, checkIn, checkOut, reservation, breakfastFlag }).then(calculatedHash => {
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
                  // Check if room already exists in localStorage with status "1"
                  const localData = JSON.parse(localStorage.getItem("waitingList") || "[]");
                  const existing = localData.find(entry => entry.split(",")[0] === room);
                  if (existing && existing.split(",")[3] === "1") {
                    alert(`${room}号はすでに朝食を召し上がりました。`);
                    return;
                  }
                  window.currentRoomText = room;
                  window.maxGuestsFromQR = parseInt(guests);
                  document.getElementById("customPromptOverlay").style.display = "flex";
                  document.getElementById("guestCountInput").focus();

                  // Save to localStorage
                  const now = new Date();
                  const yyyy = now.getFullYear();
                  const mm = String(now.getMonth() + 1).padStart(2, '0');
                  const dd = String(now.getDate()).padStart(2, '0');
                  const hh = String(now.getHours()).padStart(2, '0');
                  const min = String(now.getMinutes()).padStart(2, '0');
                  const formattedTime = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
                  const newData = `${room},${parseInt(guests)},${formattedTime},0`;
                  const index = localData.findIndex(entry => entry.split(",")[0] === room);
                  if (index !== -1) {
                    localData[index] = newData;
                  } else {
                    localData.push(newData);
                  }
                  localStorage.setItem("waitingList", JSON.stringify(localData));
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
      if (text === "#0") {
        const allData = JSON.parse(localStorage.getItem("waitingList") || "[]");
        if (allData.length === 0) {
          alert("ローカルストレージにデータがありません。");
        } else {
          const display = allData.map(entry => {
            const parts = entry.split(",");
            const statusText = parts[3] === "1" ? "入場" : "待機";
            return `${parts[0]}号 ${parts[1]}名 ${parts[2]} (${statusText})`;
          }).join("\n");
          alert(display);
        }
        return;
      }

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
            const localData = JSON.parse(localStorage.getItem("waitingList") || "[]");
            const index = localData.findIndex(entry => entry.split(",")[0] === room);
            if (index !== -1) {
              const [roomNum, guests, timestamp] = localData[index].split(",");
              const updatedEntry = `${roomNum},${guests},${timestamp},1`;
              localData[index] = updatedEntry;
              localStorage.setItem("waitingList", JSON.stringify(localData));

              // JSONP 방식으로 서버에 데이터 전송
              const jsonpScript = document.createElement("script");
              jsonpScript.src = `${SCRIPT_BASE_URL}?callback=handlePostResponse`
                + `&room=${encodeURIComponent(roomNum)}`
                + `&guests=${encodeURIComponent(guests)}`
                + `&timestamp=${encodeURIComponent(timestamp)}`;
              document.body.appendChild(jsonpScript);
            }
          };
          listContainer.appendChild(button);
        }

        // Save to localStorage
        const localData = JSON.parse(localStorage.getItem("waitingList") || "[]");
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const formattedTime = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
        const newData = `${room},${parseInt(guests)},${formattedTime},0`;
        const index = localData.findIndex(entry => entry.split(",")[0] === room);
        if (index !== -1) {
          localData[index] = newData;
        } else {
          localData.push(newData);
        }
        localStorage.setItem("waitingList", JSON.stringify(localData));

        logDebug(`🟢 ${room}号 ${guests}名 を待機リストに追加または更新`);
      } else if (command === "2") {
        if (!room) {
          alert("キャンセルには部屋番号が必要です（例: #2,501）");
          return;
        }

        if (existingButton) {
          listContainer.removeChild(existingButton);
          logDebug(`🗑️ ${room}号 を待機リストから削除`);
        } else {
          alert(`${room}号 は待機リストに存在しません`);
        }
      } else {
        alert("不明なコマンドです。");
      }

      document.getElementById("qrResult").value = "";
      return;
    }

    const parts = text.split(",");
    if (parts.length === 7) {
      // Destructure in the correct order including guests
      const [room, checkIn, checkOut, guests, reservation, breakfastFlag, hashFromQR] = parts;
      // Only pass the required fields (excluding guests) to generateHash
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
      const localData = JSON.parse(localStorage.getItem("waitingList") || "[]");
      const index = localData.findIndex(entry => entry.split(",")[0] === text);
      if (index !== -1) {
        const [roomNum, guests, timestamp] = localData[index].split(",");
        const updatedEntry = `${roomNum},${guests},${timestamp},1`;
        localData[index] = updatedEntry;
        localStorage.setItem("waitingList", JSON.stringify(localData));

        const jsonpScript = document.createElement("script");
        jsonpScript.src = `${SCRIPT_BASE_URL}?callback=handlePostResponse`
          + `&room=${encodeURIComponent(roomNum)}`
          + `&guests=${encodeURIComponent(guests)}`
          + `&timestamp=${encodeURIComponent(timestamp)}`;
        document.body.appendChild(jsonpScript);
      }
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

    const newData = `${text},${parseInt(guests)},${formattedTime},0`;

    // 기존 항목이 있다면 업데이트
    const index = localData.findIndex(entry => entry.split(",")[0] === text);
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

window.handlePostResponse = function(response) {
  console.log("📦 서버 응답:", response); // 콘솔에 출력
  if (response && response.success) {
    alert("記録が完了しました。");
  } else {
    alert("記録中にエラーが発生しました。");
    console.error("記録エラー:", response);
  }
};