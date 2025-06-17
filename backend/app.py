# app.py

from flask import Flask, g, send_from_directory
from flask_socketio import SocketIO
from flask_cors import CORS
import sqlite3
import os
import pandas as pd
from datetime import datetime
import traceback

# -----------------------------
# 기본 설정
# -----------------------------
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route("/static/images/parts/<path:filename>")
def custom_serve_part_image(filename):
    """
    React 프록시가 /static/images/parts/<filename> 요청을 보내면
    기본 static 서빙 대신 여기를 타게 됩니다.
    자세한 로그를 찍으면서, 파일 존재 여부 및 권한 체크 후 서빙해 봅시다.
    """
    try:
        # 1) 프로젝트 루트(즉, app.py가 있는 폴더) 경로를 기준으로 static 폴더 위치 계산
        base_dir = os.path.dirname(os.path.abspath(__file__))
        static_parts_dir = os.path.join(base_dir, "static", "images", "parts")

        # 2) 파일 풀 경로
        full_path = os.path.join(static_parts_dir, filename)

        # 3) 로깅: 요청 들어온 Filename과 풀 경로 출력
        print(f"[Static_Debug] 요청된 파일명: '{filename}'")
        print(f"[Static_Debug] 실제 풀 경로: '{full_path}'")

        # 4) 파일 존재 여부 체크
        if not os.path.isfile(full_path):
            print(f"[Static_Debug] 파일을 찾을 수 없습니다 (404): {full_path}")
            return "Not Found", 404

        # 5) 파일 권한(읽기) 체크: 읽어볼 수 있는지 시도
        try:
            with open(full_path, "rb") as f:
                f.read(1)  # 첫 바이트만 읽어보아서 예외 발생 여부 확인
            print(f"[Static_Debug] 파일 열기 성공: {full_path}")
        except Exception as open_err:
            print(f"[Static_Debug] 파일 열기 중 예외 발생: {open_err}")
            traceback.print_exc()  # 자세한 스택 트레이스 출력
            return "Internal Server Error (파일 읽기 실패)", 500

        # 6) 정상 서빙
        return send_from_directory(static_parts_dir, filename)

    except Exception as e:
        # 7) 그 외 모든 예외를 잡아서 로그로 출력
        print("[Static_Debug] 기타 예외 발생:")
        traceback.print_exc()  # 전체 스택 트레이스
        return "Internal Server Error (기타 예외)", 500
    
# ────────────────────────────────────────────────────

@app.route("/static/images/assemblies/<path:filename>")
def custom_serve_assembly_image(filename):
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        static_assemblies_dir = os.path.join(base_dir, "static", "images", "assemblies")
        full_path = os.path.join(static_assemblies_dir, filename)

        print(f"[Assembly_Static] 요청된 파일명: '{filename}'")
        print(f"[Assembly_Static] 실제 풀 경로: '{full_path}'")

        if not os.path.isfile(full_path):
            print(f"[Assembly_Static] 파일 없음 (404): {full_path}")
            return "Not Found", 404

        try:
            with open(full_path, "rb") as f:
                f.read(1)
            print(f"[Assembly_Static] 파일 열기 성공: {full_path}")
        except Exception as open_err:
            print(f"[Assembly_Static] 파일 열기 실패: {open_err}")
            traceback.print_exc()
            return "Internal Server Error (파일 읽기 실패)", 500

        return send_from_directory(static_assemblies_dir, filename)

    except Exception as e:
        print("[Assembly_Static] 기타 예외:")
        traceback.print_exc()
        return "Internal Server Error (기타 예외)", 500


from routes.parts import parts_bp
app.register_blueprint(parts_bp)

from routes.assemblies import assemblies_bp
app.register_blueprint(assemblies_bp)

from routes.parts import order_bp 
app.register_blueprint(order_bp)

DATABASE = os.path.join(os.getcwd(), 'inventory.db')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(error):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db_once():
    if not os.path.exists(DATABASE):
        print("inventory.db가 없어 초기화합니다...")
        with sqlite3.connect(DATABASE) as conn:
            with open("schema.sql", encoding="utf-8") as f:
                conn.executescript(f.read())
        print("DB 초기화 완료!")

if __name__ == "__main__":
    init_db_once()
    socketio.run(app, host="0.0.0.0", port=8000, debug=True)
