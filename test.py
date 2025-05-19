import requests

payload = {
    "csv": "abc,101,홍길동,2025-05-20,2025-05-21,2,1,honggildong,0,메모입니다",
    "roomOnly": "101"
}
headers = {
    "Content-Type": "application/json"
}

GAS_URL = "https://script.google.com/macros/s/AKfycbyUX-UxT4HMDoTbRP942j41HpPM-6cirW65IBUFtegkUOv9SKjRzygXdMpG14_BC3wqig/exec"

try:
    response = requests.post(GAS_URL, headers=headers, json=payload, timeout=10)
    print("✅ 상태코드:", response.status_code)
    print("✅ 응답:", response.text)
except Exception as e:
    print("❌ 오류:", e)