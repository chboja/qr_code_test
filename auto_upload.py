from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import os
import time
import tkinter as tk
from tkinter import messagebox, filedialog
import threading
import pandas as pd
import re
import jaconv
import requests

# --- Tkinter GUI and Message Functions ---
def show_message(title, message):
    print(f"[{title}] {message}")

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
def process_and_upload():
    # --- Step 1: Selenium으로 CSV 다운로드 ---
    download_dir = os.path.join(os.path.expanduser("~"), "Downloads")

    options = Options()
    options.add_experimental_option("prefs", {
        "download.default_directory": download_dir,
        "download.prompt_for_download": False,
        "directory_upgrade": True
    })
    # options.add_argument("--headless")  # UI 없이 실행할 경우

    driver = webdriver.Chrome(options=options)

    try:
        driver.get("https://pms.innto.jp/login.html")
        time.sleep(2)
        driver.find_element(By.ID, "hotelId").send_keys("A50943")
        driver.find_element(By.ID, "accountName").send_keys("g7N5ECMc")
        driver.find_element(By.ID, "password").send_keys("J4qUK_GE")
        WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.CLASS_NAME, "command-button"))).click()

        driver.get("https://pms.innto.jp/#/reservation/index")
        WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.CLASS_NAME, "grid-row")))

        download_icon = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "span.iconfont-icon_download"))
        )
        download_button = download_icon.find_element(By.XPATH, "./ancestor::button")
        download_button.click()

        def wait_for_download_complete(timeout=30):
            start = time.time()
            while True:
                cr_files = [f for f in os.listdir(download_dir) if f.endswith(".crdownload")]
                if not cr_files:
                    break
                if time.time() - start > timeout:
                    raise TimeoutError("⏰ 다운로드 시간 초과")
                time.sleep(1)

        wait_for_download_complete()

        files = [f for f in os.listdir(download_dir) if f.endswith(".csv")]
        csv_file_path = max([os.path.join(download_dir, f) for f in files], key=os.path.getctime)
        print(f"✅ 다운로드된 파일: {csv_file_path}")

    except Exception as e:
        print("❌ 다운로드 오류:", e)
        show_message("エラー", f"❌ ダウンロードエラー: {e}")
        driver.quit()
        return
    finally:
        driver.quit()

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
            show_message("成功", "お客様情報を更新しました。")
        else:
            show_message("失敗", f"❌ ステータスコード: {response.status_code}")
    except Exception as e:
        print("❌ 업로드 실패:", e)
        show_message("エラー", f"❌ リクエスト失敗: {e}")
    finally:
        # 업로드 성공/실패 여부와 관계없이 파일 삭제 시도
        try:
            os.remove(csv_file_path)
            print(f"🗑️ CSV 파일 삭제 완료: {csv_file_path}")
        except Exception as del_err:
            print(f"⚠️ CSV 파일 삭제 실패: {del_err}")

# --- 시작 ---
if __name__ == "__main__":
    try:
        process_and_upload()
    except Exception as e:
        print("❌ 처리 중 예외 발생:", e)
    finally:
        # exe로 실행 시 자동 종료
        import sys
        sys.exit()