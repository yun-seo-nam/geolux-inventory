import os
import ipaddress
import sqlite3
import traceback
from datetime import timedelta  # (남는다면 제거 가능)
from flask import Flask, g, send_from_directory, abort, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO

# ─────────────────────────────────────────────────────────────
# 기본 설정
# ─────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "inventory.db")

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "your_secret_key_here")

app.config["DATABASE"] = DATABASE

# CORS (정확한 오리진만 허용; 쿠키/자격증명 불필요하므로 supports_credentials=False)
CORS(
    app,
    supports_credentials=False
)

# SocketIO 
socketio = SocketIO(
    app
)

# ─────────────────────────────────────────────────────────────
# DB 핸들러
# ─────────────────────────────────────────────────────────────
def get_db():
    if "db" not in g:
        # SocketIO/스레드 환경 고려
        g.db = sqlite3.connect(DATABASE, check_same_thread=False)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(error):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def init_db_once():
    if not os.path.exists(DATABASE):
        print("inventory.db가 없어 초기화합니다...")
        with sqlite3.connect(DATABASE) as conn:
            schema_path = os.path.join(BASE_DIR, "schema.sql")
            with open(schema_path, encoding="utf-8") as f:
                conn.executescript(f.read())
        print("DB 초기화 완료!")

# ─────────────────────────────────────────────────────────────
# 사내망 IP 제한 (+ CORS preflight 허용)
# ─────────────────────────────────────────────────────────────
@app.before_request
def restrict_to_company_wifi():
    if request.method == "OPTIONS":  # CORS preflight는 통과
        return None
    allowed_network = ipaddress.IPv4Network("192.168.0.0/24")
    client_ip_raw = request.headers.get("X-Forwarded-For", request.remote_addr)
    client_ip = ipaddress.IPv4Address(client_ip_raw.split(",")[0].strip())
    if client_ip not in allowed_network and client_ip != ipaddress.IPv4Address("127.0.0.1"):
        abort(403)

# ─────────────────────────────────────────────────────────────
# 헬스체크
# ─────────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

# ─────────────────────────────────────────────────────────────
# 정적 파일 (이미지) 서빙
# ─────────────────────────────────────────────────────────────
@app.route("/static/images/parts/<path:filename>")
def serve_part_image(filename):
    try:
        static_dir = os.path.join(BASE_DIR, "static", "images", "parts")
        full_path = os.path.join(static_dir, filename)
        if not os.path.isfile(full_path):
            return "Not Found", 404
        return send_from_directory(static_dir, filename)
    except Exception:
        traceback.print_exc()
        return "Internal Server Error", 500

@app.route("/static/images/assemblies/<path:filename>")
def serve_assembly_image(filename):
    try:
        static_dir = os.path.join(BASE_DIR, "static", "images", "assemblies")
        full_path = os.path.join(static_dir, filename)
        if not os.path.isfile(full_path):
            return "Not Found", 404
        return send_from_directory(static_dir, filename)
    except Exception:
        traceback.print_exc()
        return "Internal Server Error", 500

# ─────────────────────────────────────────────────────────────
# 블루프린트 등록 (프로젝트 구조에 맞게 유지)
# ─────────────────────────────────────────────────────────────
from routes.projects import projects_bp
from routes.parts import parts_bp, order_bp
from routes.assemblies import assemblies_bp

app.register_blueprint(projects_bp)
app.register_blueprint(parts_bp)
app.register_blueprint(order_bp)
app.register_blueprint(assemblies_bp)

# ─────────────────────────────────────────────────────────────
# 엔트리포인트
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    init_db_once()
    socketio.run(app, host="0.0.0.0", port=8000, debug=True)
