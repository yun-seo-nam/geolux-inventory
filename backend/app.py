from flask import Flask, g, send_from_directory, abort, request, jsonify
import ipaddress
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_bcrypt import Bcrypt
import sqlite3
import os
import traceback
from werkzeug.security import check_password_hash, generate_password_hash
from flask_jwt_extended import create_access_token, JWTManager, set_access_cookies, unset_jwt_cookies, jwt_required, get_jwt_identity

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, 'inventory.db')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'
CORS(app,
     supports_credentials=True,
     origins=[
         "http://localhost:3000",
         "http://192.168.0.3:3000"
     ])
socketio = SocketIO(app, cors_allowed_origins="*")
bcrypt = Bcrypt(app)

# JWT 설정
app.config["JWT_SECRET_KEY"] = "super-secret"
app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
app.config["JWT_COOKIE_SECURE"] = False
app.config["JWT_COOKIE_CSRF_PROTECT"] = False # 개발 편의상 False
jwt = JWTManager(app)

# ---------------------------
# 사내망 IP 제한
# ---------------------------
@app.before_request
def restrict_to_company_wifi():
    allowed_network = ipaddress.IPv4Network("192.168.0.0/24")
    client_ip_raw = request.headers.get("X-Forwarded-For", request.remote_addr)
    client_ip = ipaddress.IPv4Address(client_ip_raw.split(',')[0].strip())
    if client_ip not in allowed_network and client_ip != ipaddress.IPv4Address("127.0.0.1"):
        print(f"차단된 외부 IP 접근: {client_ip}")
        abort(403)

# ---------------------------
# 회원가입
# ---------------------------
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    db = get_db()
    cur = db.execute("SELECT id FROM users WHERE username = ?", (data['username'],))
    if cur.fetchone():
        return jsonify({'msg': 'Username already exists'}), 400
    hashed_pw = generate_password_hash(data['password'])
    db.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (data['username'], hashed_pw))
    db.commit()
    return jsonify({'msg': 'User created successfully'}), 201

# ---------------------------
# 로그인
# ---------------------------
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    db = get_db()
    cur = db.execute("SELECT * FROM users WHERE username = ?", (data['username'],))
    row = cur.fetchone()

    if row and check_password_hash(row['password_hash'], data['password']):
        access_token = create_access_token(identity=row['id'])
        response = jsonify({'msg': 'Login successful', 'user': {'id': row['id'], 'name': row['username']}})
        set_access_cookies(response, access_token)
        return response, 200
    
    return jsonify({'msg': '아이디 혹은 비밀번호가 일치하지 않습니다'}), 401

# ---------------------------
# 로그아웃
# ---------------------------
@app.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    response = jsonify({'msg': '로그아웃 되었습니다'})
    unset_jwt_cookies(response)
    return response, 200

# ---------------------------
# 로그인 상태 확인
# ---------------------------
@app.route('/profile', methods=['GET'])
@jwt_required()
def profile():
    current_user_id = get_jwt_identity()
    db = get_db()
    cur = db.execute("SELECT id, username FROM users WHERE id = ?", (current_user_id,))
    row = cur.fetchone()
    if row:
        return jsonify({'user': {'id': row['id'], 'name': row['username']}})
    return jsonify({'msg': '사용자를 찾을 수 없습니다'}), 404

# ---------------------------
# 사용자 관련
# ---------------------------

# 사용자 목록 불러오기
@app.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    db = get_db()
    cur = db.execute("SELECT id, username FROM users")
    rows = cur.fetchall()
    users = [{'value': row['id'], 'label': row['username']} for row in rows]
    return jsonify(users), 200

# 사용자 추가
@app.route('/users', methods=['POST'])
@jwt_required()
def add_user():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'msg': 'Username and password are required'}), 400

    db = get_db()
    cur = db.execute("SELECT id FROM users WHERE username = ?", (username,))
    if cur.fetchone():
        return jsonify({'msg': 'Username already exists'}), 400

    hashed_pw = generate_password_hash(password)
    db.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, hashed_pw))
    db.commit()
    return jsonify({'msg': 'User added successfully'}), 201

# 사용자 삭제
@app.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    db = get_db()
    db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    db.commit()
    return jsonify({'msg': 'User deleted successfully'}), 200
    
@app.route("/static/images/parts/<path:filename>")
def custom_serve_part_image(filename):
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        static_parts_dir = os.path.join(base_dir, "static", "images", "parts")
        full_path = os.path.join(static_parts_dir, filename)

        if not os.path.isfile(full_path):
            return "Not Found", 404

        return send_from_directory(static_parts_dir, filename)

    except Exception as e:
        traceback.print_exc()
        return "Internal Server Error", 500
    
# ────────────────────────────────────────────────────

@app.route("/static/images/assemblies/<path:filename>")
def custom_serve_assembly_image(filename):
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        static_assemblies_dir = os.path.join(base_dir, "static", "images", "assemblies")
        full_path = os.path.join(static_assemblies_dir, filename)

        if not os.path.isfile(full_path):
            return "Not Found", 404

        return send_from_directory(static_assemblies_dir, filename)

    except Exception as e:
        traceback.print_exc()
        return "Internal Server Error", 500

from routes.projects import projects_bp
app.register_blueprint(projects_bp)

from routes.parts import parts_bp, order_bp
app.register_blueprint(parts_bp)
app.register_blueprint(order_bp)

from routes.assemblies import assemblies_bp
app.register_blueprint(assemblies_bp)

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