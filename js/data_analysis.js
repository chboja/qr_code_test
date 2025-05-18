function getScriptUrl() {
  // 아래 URL을 배포된 Apps Script 웹 앱 주소로 교체하세요
  return "https://script.google.com/macros/s/AKfycbw9d5HMBvkJQLNyjv-sLUk55G_468oJxD2PIOGXs4pn4HVUIk-eLxOPrr0pOc8GPhwOhQ/exec";
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

  const container = document.getElementById("stats-container");
  container.innerHTML = "";

  if (response.rows.length === 0) {
    container.innerHTML = "<p>해당 기간에 데이터가 없습니다.</p>";
    return;
  }

  const table = document.createElement("table");
  table.border = "1";
  table.cellPadding = "6";
  table.style.borderCollapse = "collapse";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>날짜</th>
      <th>방 번호</th>
      <th>인원 수</th>
    </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  response.rows.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.date}</td>
      <td>${row.room}</td>
      <td>${row.guests}</td>`;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);

  // 총 이용객 수 계산
  const guestSum = response.rows.reduce((sum, row) => sum + row.guests, 0);

  // 날짜 차이 계산 (종료일 - 시작일 + 1일 포함)
  const start = new Date(document.getElementById("stats-start-date").value);
  const end = new Date(document.getElementById("stats-end-date").value);
  const dateDiff = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

  // 일평균 계산
  const guestAvg = Math.round(guestSum / dateDiff);

  // HTML 출력 비활성화
  // document.getElementById("sum-guest").textContent = guestSum;
  // document.getElementById("avg-guest").textContent = guestAvg;

  // 디버그 로그 출력
  console.log("총 이용객 수:", guestSum);
  console.log("총 일수:", dateDiff);
  console.log("일평균 이용객 수:", guestAvg);
}