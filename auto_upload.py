import tkinter as tk
from tkinter import messagebox, filedialog
import threading
import pandas as pd
import re
import jaconv
import requests

# --- Tkinter GUI and Message Functions ---
def show_working_window():
    global root
    root = tk.Tk()
    root.title("更新中")
    root.geometry("300x100")
    label = tk.Label(root, text="顧客情報を更新中...", font=("Arial", 14))
    label.pack(expand=True)
    root.attributes('-topmost', True)
    root.after(100, start_upload_thread)
    root.mainloop()

def show_message(title, message):
    messagebox.showinfo(title, message)

# --- CSV Processing Utilities ---
def format_date(raw):
    try:
        dt = pd.to_datetime(raw)
        return dt.strftime("%Y-%m-%d")
    except:
        return ""

def normalize_search_name(name):
    name = str(name).strip()
    if re.match(r'^[\x00-\x7F\s]+$', name):
        return name.lower()
    return jaconv.hira2kata(jaconv.z2h(name, kana=True, digit=False, ascii=False))

# --- Upload Worker ---
def start_upload_thread():
    threading.Thread(target=process_and_upload).start()

def process_and_upload():
    # CSV 선택
    root.withdraw()
    csv_file_path = filedialog.askopenfilename(
        title="CSV 파일 선택",
        filetypes=[("CSV 파일", "*.csv")]
    )
    if not csv_file_path:
        show_message("エラー", "CSVファイルが選択されていません。")
        root.quit()
        return

    df = pd.read_csv(csv_file_path, encoding="cp932")

    rows = []
    for _, row in df.iterrows():
        if str(row.get("ステータス", "")).strip() == "キャンセル":
            continue

        reservation = str(row.get("#予約番号", "")).strip()
        raw_room = str(row.get("部屋名", "")).strip()
        room_match = re.search(r"\d{1,3}", raw_room)
        room = room_match.group(0) if room_match else raw_room

        name = str(row.get("予約者", "")).strip()
        check_in = format_date(row.get("C/I", ""))
        check_out = format_date(row.get("C/O", ""))
        guests = str(row.get("大人人数", "")).strip()
        plan = str(row.get("プラン名", "")).lower()

        breakfast_flag = "0" if "room only" in plan else "1"
        search_name = normalize_search_name(name)

        unpaid_raw = row.get("未収金")
        unpaid = "0" if unpaid_raw == "なし" else str(unpaid_raw).strip().replace(",", "、") if not pd.isna(unpaid_raw) else ""

        memo_raw = row.get("メモ")
        memo = str(memo_raw).strip().replace(",", "、").replace("\r", "") if not pd.isna(memo_raw) else ""

        csv_line = ",".join([
            reservation,
            room,
            name,
            check_in,
            check_out,
            guests,
            breakfast_flag,
            search_name,
            unpaid,
            memo
        ])
        rows.append(csv_line)

    # rows will be sent as JSON array now
    # final_payload = ";".join(rows)
    room_only_rooms = (
        df[df["プラン名"].str.lower().str.contains("room only", na=False)]["部屋名"]
        .dropna()
        .map(lambda s: re.search(r"\d{1,3}", s).group(0) if re.search(r"\d{1,3}", s) else None)
        .dropna()
        .unique()
        .tolist()
    )

    GAS_URL = "https://script.google.com/macros/s/AKfycbyjgXAbIACYgt0fddimb1BLRx307gpsazwJdFJ7IM26H7bQUBs7M-QKn21WxWmAQqaitQ/exec"
    upload_payload = {
        "rows": [row.split(",") for row in rows],
        "roomOnly": ",".join(room_only_rooms)
    }
    headers = {
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(GAS_URL, headers=headers, json=upload_payload, timeout=10)
        print("📥 응답 코드:", response.status_code)
        print("📥 응답 텍스트:", response.text)
        if response.status_code == 200:
            show_message("成功", "✅ Googleスプレッドシートへのアップロードが完了しました！")
        else:
            show_message("失敗", f"❌ ステータスコード: {response.status_code}")
    except Exception as e:
        print("❌ 업로드 실패:", e)
        show_message("エラー", f"❌ リクエスト失敗: {e}")
    finally:
        root.quit()

# --- 시작 ---
if __name__ == "__main__":
    show_working_window()