function getScriptUrl() {
  // 아래 URL을 배포된 Apps Script 웹 앱 주소로 교체하세요
  return "https://script.google.com/macros/s/YOUR_DEPLOYED_SCRIPT_ID/exec";
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
  // TODO: 화면에 결과 출력
}