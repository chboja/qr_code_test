
// Include WanaKana for romaji to katakana conversion

// --- generateHash function (standalone, not imported) ---
async function generateHash(room, checkIn, checkOut, guests, reservation, breakfastFlag) {
  const secret = "HOTEL_ONLY_SECRET_KEY";
  const data = `${room},${checkIn},${checkOut},${reservation},${breakfastFlag}`;
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data + secret));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

async function generateHashFromObject({ room, checkIn, checkOut }) {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const days = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
  const secret = "HOTEL_ONLY_SECRET_KEY";

  const data = `${room},${checkIn},${checkOut},${days}`;
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data + secret));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}
const getSheetApiUrl = () => 'https://script.google.com/macros/s/AKfycbwOFUuxlwt90WSf_t4JHcJsWh8t7bmkcKddSkbvfVaeHayiNsgAE7lCdXHCd5wzP1zS9Q/exec';
const wanakanaScript = document.createElement("script");
wanakanaScript.src = "https://unpkg.com/wanakana";
document.head.appendChild(wanakanaScript);

// Convert full-width katakana to half-width katakana (including voiced/semi-voiced marks)
function kanaFullToHalf(str){
    let kanaMap = {
        "ガ": "ｶﾞ", "ギ": "ｷﾞ", "グ": "ｸﾞ", "ゲ": "ｹﾞ", "ゴ": "ｺﾞ",
        "ザ": "ｻﾞ", "ジ": "ｼﾞ", "ズ": "ｽﾞ", "ゼ": "ｾﾞ", "ゾ": "ｿﾞ",
        "ダ": "ﾀﾞ", "ヂ": "ﾁﾞ", "ヅ": "ﾂﾞ", "デ": "ﾃﾞ", "ド": "ﾄﾞ",
        "バ": "ﾊﾞ", "ビ": "ﾋﾞ", "ブ": "ﾌﾞ", "ベ": "ﾍﾞ", "ボ": "ﾎﾞ",
        "パ": "ﾊﾟ", "ピ": "ﾋﾟ", "プ": "ﾌﾟ", "ペ": "ﾍﾟ", "ポ": "ﾎﾟ",
        "ヴ": "ｳﾞ", "ヷ": "ﾜﾞ", "ヺ": "ｦﾞ",
        "ア": "ｱ", "イ": "ｲ", "ウ": "ｳ", "エ": "ｴ", "オ": "ｵ",
        "カ": "ｶ", "キ": "ｷ", "ク": "ｸ", "ケ": "ｹ", "コ": "ｺ",
        "サ": "ｻ", "シ": "ｼ", "ス": "ｽ", "セ": "ｾ", "ソ": "ｿ",
        "タ": "ﾀ", "チ": "ﾁ", "ツ": "ﾂ", "テ": "ﾃ", "ト": "ﾄ",
        "ナ": "ﾅ", "ニ": "ﾆ", "ヌ": "ﾇ", "ネ": "ﾈ", "ノ": "ﾉ",
        "ハ": "ﾊ", "ヒ": "ﾋ", "フ": "ﾌ", "ヘ": "ﾍ", "ホ": "ﾎ",
        "マ": "ﾏ", "ミ": "ﾐ", "ム": "ﾑ", "メ": "ﾒ", "モ": "ﾓ",
        "ヤ": "ﾔ", "ユ": "ﾕ", "ヨ": "ﾖ",
        "ラ": "ﾗ", "リ": "ﾘ", "ル": "ﾙ", "レ": "ﾚ", "ロ": "ﾛ",
        "ワ": "ﾜ", "ヲ": "ｦ", "ン": "ﾝ",
        "ァ": "ｧ", "ィ": "ｨ", "ゥ": "ｩ", "ェ": "ｪ", "ォ": "ｫ",
        "ッ": "ｯ", "ャ": "ｬ", "ュ": "ｭ", "ョ": "ｮ",
        "。": "｡", "、": "､", "ー": "ｰ", "「": "｢", "」": "｣", "・": "･",
        "　": " "
    };
    let reg = new RegExp('(' + Object.keys(kanaMap).join('|') + ')', 'g');
    return str.replace(reg, function(s){
        return kanaMap[s];
    }).replace(/゛/g, 'ﾞ').replace(/゜/g, 'ﾟ');
}

wanakanaScript.onload = () => {
  const searchBtName = document.getElementById("searchBtName");
  if (searchBtName) {
    searchBtName.addEventListener("click", () => {
      if (!window.wanakana || !wanakana.toKatakana) {
        alert("wanakana error");
        return;
      }
      // --- Show search overlay before sending requests ---
      const overlay = document.createElement("div");
      overlay.id = "searchOverlay";
      overlay.style.position = "fixed";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100vw";
      overlay.style.height = "100vh";
      overlay.style.backgroundColor = "rgba(0, 0, 0, 0.4)";
      overlay.style.display = "flex";
      overlay.style.justifyContent = "center";
      overlay.style.alignItems = "center";
      overlay.style.zIndex = "9999";
      overlay.style.color = "white";
      overlay.style.fontSize = "24px";
      overlay.textContent = "検索中…";
      document.body.appendChild(overlay);

      console.log("🧪 名前検索クリック");
      const baseInput = document.getElementById("name").value.trim();
      console.log("🔍 検索対象の入力:", baseInput);
      if (!baseInput) {
        alert("名前を入力してください。");
        // Remove overlay if input is empty and early return
        const existingOverlay = document.getElementById("searchOverlay");
        if (existingOverlay) existingOverlay.remove();
        return;
      }

      const fullKatakana = wanakana.toKatakana(baseInput);
      const halfKana = kanaFullToHalf(fullKatakana);
      const romajiInput = wanakana.toRomaji(baseInput);
      console.log("✅ kana:", fullKatakana);
      console.log("✅ halfKana:", halfKana);
      console.log("✅ romajiInput:", romajiInput);

      const searchTerms = Array.from(new Set([
        normalize(baseInput),
        halfKana, // use raw half-width kana instead of normalize
        normalize(romajiInput)
      ]));
      console.log("🔍 生成された検索語一覧:", searchTerms);

      pendingNameRequests = searchTerms.length;
      foundResults = [];

      searchTerms.forEach(term => {
        const script = document.createElement("script");
        script.src = `${getSheetApiUrl()}?callback=handleSearchResult&name=${encodeURIComponent(term)}`;
        document.body.appendChild(script);
      });
    });
  }

  // --- 部屋番号検索機能 追加 ---
  const searchBtRoom = document.getElementById("searchBtRoom");
  if (searchBtRoom) {
    searchBtRoom.addEventListener("click", () => {
      const baseInput = document.getElementById("room").value.trim();
      if (!baseInput) {
        alert("部屋番号を入力してください。");
        return;
      }

      console.log("🧪 部屋番号検索クリック");
      console.log("🔍 検索対象の部屋番号:", baseInput);

      const searchTerm = normalize(baseInput);
      const script = document.createElement("script");
      script.src = `${getSheetApiUrl()}?callback=handleRoomSearchResult&room=${encodeURIComponent(searchTerm)}`;
      document.body.appendChild(script);
    });
  }
};


// JSONP callback for upload responses
let pendingNameRequests = 0;
let foundResults = [];

function toHalfWidth(str) {
  // Convert full-width A-Z, a-z, 0-9 to half-width
  return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (s) {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  });
}

function toHalfWidthKana(str) {
  // Convert full-width katakana to half-width katakana
  return str.replace(/[\u30A1-\u30F6]/g, function(char) {
    const code = char.charCodeAt(0) - 0x60;
    return String.fromCharCode(code);
  });
}

const normalize = str => toHalfWidth(str).toLowerCase().replace(/\s+/g, "");

function fillFormWithData(data) {
  console.log("🧾 fillFormWithData:", data);
  document.getElementById("name").value = data.name || "";
  document.getElementById("room").value = data.room || "";
  document.getElementById("checkIn").value = data.checkIn || "";
  document.getElementById("checkOut").value = data.checkOut || "";
  document.getElementById("guests").value = data.guestCount || "";
  document.getElementById("reservation").value = data.reservation || "";
  document.getElementById("payment").value = data.unpaid !== undefined ? String(data.unpaid) : "";
  document.getElementById("breakfast").value = data.breakfastFlag === 1 ? "O" : data.breakfastFlag === 0 ? "X" : "";
  // Show alert popup if memo exists
  if (data.memo && data.memo.trim() !== "") {
    alert(`📌 メモ:\n${data.memo}`);
  }
}

window.handleSearchResult = function(response) {
  console.log("🔍 検索結果:", response);
  pendingNameRequests--;

  const data = response.success ? (response.matches || []) : [];
  if (response.success && data.length > 0) {
    foundResults.push(...data);
  }

  if (pendingNameRequests === 0) {
    // Remove search overlay
    const existingOverlay = document.getElementById("searchOverlay");
    if (existingOverlay) existingOverlay.remove();

    if (foundResults.length === 0) {
      alert("一致する名前が見つかりませんでした。");
      return;
    }

    if (foundResults.length === 1) {
      fillFormWithData(foundResults[0]);
    } else {
      // Format date as MM/DD for display
      const formatToMMDD = (dateStr) => {
        const date = new Date(dateStr);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${mm}/${dd}`;
      };
      const nameOptions = foundResults.map((item, index) =>
        `${index + 1}. ${item.name}, #${item.room}, ${formatToMMDD(item.checkIn)}-${formatToMMDD(item.checkOut)}`
      ).join("\n");
      const selected = prompt(`複数の一致が見つかりました。番号を選んでください:\n${nameOptions}`);
      const selectedIndex = parseInt(selected, 10) - 1;
      if (!isNaN(selectedIndex) && foundResults[selectedIndex]) {
        fillFormWithData(foundResults[selectedIndex]);
      }
    }

    // Reset after handling
    foundResults = [];
  }
};

// JSONP callback for upload responses
window.handleJsonpResponse = function(response) {
  console.log("📥 アップロード結果:", response);
  if (response.debug) {
    console.log("📊 combined:", response.debug.combined);
    console.log("📊 expected:", response.debug.expected);
  }
  // You can handle post-upload feedback here if needed
};

// QRコード検証のJSONPコールバック
window.handleVerifyResponse = function(response) {
  console.log("🔍 QRコード検証結果:", response);
  if (!response || typeof response.isValid === "undefined") {
    alert("QRコードの検証に失敗しました。");
    return;
  }
  if (response.isValid) {
    if (response.breakfastFlag === 1) {
      // Do nothing (table code removed)
    } else {
      alert("Room Onlyの部屋です。");
    }
  } else {
    alert("QRコードが無効です。");
  }
};

// 部屋番号検索のJSONPコールバック
window.handleRoomSearchResult = function(response) {
  console.log("🔍 部屋番号検索結果:", response);
  // Remove search overlay (in case it was shown, e.g., for future compatibility)
  const existingOverlay = document.getElementById("searchOverlay");
  if (existingOverlay) existingOverlay.remove();

  if (!response.success || !response.matches || response.matches.length === 0) {
    alert("一致する部屋番号が見つかりませんでした。");
    return;
  }

  if (response.matches.length === 1) {
    fillFormWithData(response.matches[0]);
  } else {
    const roomOptions = response.matches.map((item, index) =>
      `${index + 1}: ${item.room}, ${item.name}, ${item.checkIn}, ${item.checkOut}, ${item.reservation}`
    ).join("\n");
    const selected = prompt(`複数の一致が見つかりました。番号を選んでください:\n${roomOptions}`);
    const selectedIndex = parseInt(selected, 10) - 1;
    if (!isNaN(selectedIndex) && response.matches[selectedIndex]) {
      fillFormWithData(response.matches[selectedIndex]);
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const SHEET_NAME_SEARCH_API = getSheetApiUrl();

    // ✅ チェックイン日を本日の日付に設定
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    document.getElementById("checkIn").value = `${yyyy}-${mm}-${dd}`;

  
    const form = document.getElementById("qrForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("name")?.value.trim() || "";
      const room = document.getElementById("room").value.trim() || "";
      const checkIn = document.getElementById("checkIn").value || "";
      const checkOut = document.getElementById("checkOut").value || "";
      const guests = document.getElementById("guests").value || "";
      const reservation = document.getElementById("reservation").value.trim() || "";
      const breakfast = document.getElementById("breakfast")?.value.trim() || "";

      const breakfastFlag = (breakfast === "O" || breakfast === "1") ? "1" : "0";
      const hash = await generateHash(room, checkIn, checkOut, guests, reservation, breakfastFlag);
      const qrText = `${room},${checkIn},${checkOut},${guests},${reservation},${breakfastFlag},${hash}`;

      // ✅ 팝업 티켓 정보 표시
      const textInfo = `Room : ${room}<br>Check-in : ${checkIn}<br>Check-out : ${checkOut}(~10:00)<br>Guests : ${guests}<br>Breakfast : ${breakfast}<br>Booking No : ${reservation}`;
      document.getElementById("popupText").innerHTML = textInfo;
      const popupQR = document.getElementById("popupQR");
      popupQR.innerHTML = "";
      new QRCode(popupQR, {
        text: qrText,
        width: 160,
        height: 160,
        correctLevel: QRCode.CorrectLevel.H
      });
      document.getElementById("qrOverlay").style.display = "flex";
      // Make overlay dismissible by clicking outside the popup
      const qrOverlay = document.getElementById("qrOverlay");
      qrOverlay.addEventListener("click", function (e) {
        if (e.target === qrOverlay) {
          qrOverlay.style.display = "none";
        }
      });
    });
  
    // ✅ Enter 키 입력 시 키보드 닫기
    document.getElementById("guests").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault(); // submit 방지
        e.target.blur(); // 키보드 닫기
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
        active.blur();
      }
    });
  
  // ✅ 파일 선택 후 input 초기화 (같은 파일도 다시 선택 가능)
  const fileInput = document.getElementById("fileInput");
  if (fileInput) {
    fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (e) {
        const overlay = document.createElement("div");
        overlay.id = "uploadOverlay";
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.backgroundColor = "rgba(0, 0, 0, 0.4)";
        overlay.style.display = "flex";
        overlay.style.justifyContent = "center";
        overlay.style.alignItems = "center";
        overlay.style.zIndex = "9999";
        overlay.style.color = "white";
        overlay.style.fontSize = "24px";
        overlay.textContent = "アップロード中…";
        document.body.appendChild(overlay);
        const csvText = e.target.result;

        console.log("📄 원본 CSV 미리보기:", csvText.slice(0, 500));

        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: async function (results) {
            const rows = results.data;

            const compacted = await Promise.all(rows
              .filter(row => row["ステータス"] !== "キャンセル")
              .map(async row => {
                const fullReservation = row["booking_no"]?.trim() || row["#予約番号"]?.trim() || "";
                const reservation = fullReservation;
                let rawRoom = row["room"]?.trim() || row["部屋名"]?.trim() || "";
                const room = rawRoom.match(/\d{1,3}/)?.[0] || "";
                const reserver = row["name"]?.trim() || row["予約者"]?.trim() || "";
                const checkInRaw = row["check_in"]?.trim() || row["C/I"]?.trim() || "";
                const checkOutRaw = row["check_out"]?.trim() || row["C/O"]?.trim() || "";
                const formatDate = (raw) => {
                  const dateObj = new Date(raw);
                  if (isNaN(dateObj)) return "";
                  const yyyy = dateObj.getFullYear();
                  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
                  const dd = String(dateObj.getDate()).padStart(2, "0");
                  return `${yyyy}-${mm}-${dd}`;
                };
                const checkIn = formatDate(checkInRaw);
                const checkOut = formatDate(checkOutRaw);

                const guestCount = parseInt(row["guest_no"] || row["大人人数"] || "0", 10);
                const breakfastFlag = row["breakfast"] !== undefined
                  ? parseInt(row["breakfast"])
                  : (row["プラン名"]?.toLowerCase().includes("room only") ? 0 : 1);

                const days = checkOut && checkIn ? Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)) : "";
                const hash = await generateHash(room, checkIn, checkOut, guestCount, reservation);

                let searchName = reserver;
                if (window.wanakana) {
                  if (/^[\x00-\x7F\s]+$/.test(reserver)) {
                    searchName = wanakana.toRomaji(reserver).toLowerCase();
                  } else {
                    searchName = wanakana.toKatakana(reserver, { IMEMode: true });
                  }
                }
                const rawUnpaid = row["未収金"]?.trim() || "";
                const unpaid = rawUnpaid === "なし" ? "0" : rawUnpaid;
                const memo = (row["メモ"] ?? "").trim().replace(/,/g, '、');
                return [reservation, room, reserver, checkIn, checkOut, guestCount, breakfastFlag, searchName, hash.slice(0, 8), unpaid, memo];
              }));

            console.log("📊 JSONP 전送用 문자열 배열 (with searchName):", compacted);
            const CHUNK_SIZE = 15;
            const expectedCount = compacted.length;
            const SHEET_API_URL = getSheetApiUrl();

            // --- 1. Clear sheet before uploading chunks (command-based) ---
            const commandScript = document.createElement("script");
            commandScript.src = `${SHEET_API_URL}?callback=handleCommandResponse&command=clear`;
            document.body.appendChild(commandScript);

            window.handleCommandResponse = function(response) {
              if (response.success && response.cleared) {
                const chunks = [];
                for (let i = 0; i < compacted.length; i += CHUNK_SIZE) {
                  chunks.push(compacted.slice(i, i + CHUNK_SIZE));
                }
                uploadCsvChunksSequentially(chunks, 0, SHEET_API_URL);
              } else {
                console.error("❌ clear command 실패", response);
              }
            };
          }
        });
      };

      reader.readAsText(file, 'shift-jis'); // Use JIS encoding for Japanese CSV
    });
  }
});
// Helper to upload CSV in chunks sequentially
function uploadCsvChunksSequentially(chunks, index = 0, SHEET_API_URL) {
  if (index >= chunks.length) return;

  const chunk = chunks[index];
  const csvChunk = chunk.map(row =>
    row.map(cell =>
      String(cell)
        .replace(/\u00A0/g, '')
        .replace(/&nbsp;/g, '')
        .replace(/,/g, '、')
    ).join(',')
  ).join(';');
  const script = document.createElement("script");
  script.src = `${SHEET_API_URL}?callback=uploadChunkCallback&csv=${encodeURIComponent(csvChunk)}`;
  document.body.appendChild(script);

  window.uploadChunkCallback = function(response) {
    console.log(`✅ 청크 ${index + 1} 업로드 완료`, response);
    if (index + 1 === chunks.length) {
      // Last chunk uploaded, remove overlay
      setTimeout(() => {
        const overlay = document.getElementById("uploadOverlay");
        if (overlay) overlay.remove();
      }, 500); // slight delay to ensure write completes
    }
    uploadCsvChunksSequentially(chunks, index + 1, SHEET_API_URL);
  };
}
// ✅ 팝업 닫기 함수
function closePopup() {
  document.getElementById("qrOverlay").style.display = "none";
}