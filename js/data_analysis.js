function getScriptUrl() {
  // 아래 URL을 배포된 Apps Script 웹 앱 주소로 교체하세요
  return "https://script.google.com/macros/s/AKfycbziVMHiUGu7zxUQAErCA58Vt5mHcbu0QSJjsitptxPvL14h2ILRm2MLKeWURoYas0stWA/exec";
}

// NOTE: 아래 YOUR_DEPLOYED_SCRIPT_ID를 실제 Google Apps Script의 배포 ID로 교체하세요!
document.addEventListener("DOMContentLoaded", () => {
  const searchButton = document.getElementById("stats-search-button");

  searchButton.addEventListener("click", () => {
    const startDate = document.getElementById("stats-start-date").value;
    const endDate = document.getElementById("stats-end-date").value;

    if (!startDate || !endDate) {
      alert("시작 날짜와 종료 날짜를 모두 선택해주세요.");
      return;
    }

    const callback = "handleStatsResponse";
    const scriptUrl = getScriptUrl();
    const query = `?mode=fetchStats&startDate=${startDate}&endDate=${endDate}&callback=${callback}`;

    const script = document.createElement("script");
    script.src = scriptUrl + query;
    document.body.appendChild(script);
  });
});

function handleStatsResponse(response) {
  if (!response.success) {
    alert("데이터를 불러오는 데 실패했습니다.");
    return;
  }

  console.log("✅ 통계 데이터:", response);


  // 총 이용객 수 계산
  const guestSum = response.rows.reduce((sum, row) => sum + row.guests, 0);

  // 날짜 차이 계산 (종료일 - 시작일 + 1일 포함)
  const start = new Date(document.getElementById("stats-start-date").value);
  const end = new Date(document.getElementById("stats-end-date").value);
  const dateDiff = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

  // 일평균 계산
  const guestAvg = Math.round(guestSum / dateDiff);

  // 디버그 로그 출력
  console.log("총 이용객 수:", guestSum);
  console.log("총 일수:", dateDiff);
  console.log("일평균 이용객 수:", guestAvg);

  // 시간대 범위 정의
  const timeRanges = [
    { label: "06:30 ~ 07:00", start: "06:30", end: "07:00", total: 0 },
    { label: "07:00 ~ 07:30", start: "07:00", end: "07:30", total: 0 },
    { label: "07:30 ~ 08:00", start: "07:30", end: "08:00", total: 0 },
    { label: "08:00 ~ 08:30", start: "08:00", end: "08:30", total: 0 },
    { label: "08:30 ~ 09:00", start: "08:30", end: "09:00", total: 0 },
    { label: "09:00 ~ 09:30", start: "09:00", end: "09:30", total: 0 },
    { label: "09:30 ~ 10:00", start: "09:30", end: "10:30", total: 0 }
  ];

  // 시간대별 합계 계산
  response.rows.forEach(row => {
    const fullTimestamp = row.timestamp || ""; // "YYYY-MM-DD HH:MM"
    const time = fullTimestamp.split(" ")[1];
    if (!time) return;

    for (const range of timeRanges) {
      if (time >= range.start && time < range.end) {
        range.total += row.guests;
        break;
      }
    }
  });

  // 시간대별 평균 출력
  console.log("📊 시간대별 통계:");
  timeRanges.forEach(range => {
    const avg = Math.round(range.total / dateDiff);
    console.log(`${range.label} → 총합: ${range.total}명, 일평균: ${avg}명`);
  });

  // 📌 roomOnly 정보 로그 출력
  console.log("🚫 조식 미포함(room only) 방 정보:");
  for (const [date, rooms] of Object.entries(response.roomOnly || {})) {
    console.log(`📅 ${date}: ${rooms.join(", ")}`);
  }
}