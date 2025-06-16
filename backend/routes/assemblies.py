from flask import Blueprint, request, jsonify, g
import sqlite3
import os
import pandas as pd
from werkzeug.utils import secure_filename

assemblies_bp = Blueprint('assemblies', __name__)

DB_PATH = os.path.join(os.getcwd(), 'inventory.db')
ASSEMBLY_IMAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static', 'images', 'assemblies')
os.makedirs(ASSEMBLY_IMAGE_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db

@assemblies_bp.route("/api/assemblies", methods=["GET"])
def get_assemblies():
    db = get_db()
    rows = db.execute("SELECT * FROM assemblies ORDER BY update_date DESC").fetchall()
    
    assemblies = []
    for row in rows:
        a = dict(row)
        if a.get("image_filename"):
            a["image_url"] = f"/static/images/assemblies/{a['image_filename']}"
        else:
            a["image_url"] = None
        assemblies.append(a)
    
    return jsonify(assemblies)

@assemblies_bp.route("/api/assemblies/upload_csv", methods=["POST"])
def upload_assembly_csv():
    if 'file' not in request.files:
        return jsonify({"error": "CSV 파일이 필요합니다"}), 400

    file = request.files['file']
    if not file.filename.endswith('.csv'):
        return jsonify({"error": "CSV 파일만 업로드 가능합니다"}), 400
    
    try:
        try:
            df = pd.read_csv(file, encoding='utf-8')
        except UnicodeDecodeError:
            file.seek(0)  
            df = pd.read_csv(file, encoding='cp949')  
    except Exception as e:
        return jsonify({"error": f"CSV 파싱 오류: {str(e)}"}), 400

    required_cols = ['Qty', 'Value', 'Device', 'Parts', 'Detailed Description', 'CATEGORY', 'DESCRIPTION', 'MANUFACTURER_NAME']
    for col in required_cols:
        if col not in df.columns:
            return jsonify({"error": f"필수 열 누락: {col}"}), 400

    db = get_db()
    cur = db.cursor()

    # 어셈블리 이름 = 파일명 (확장자 제외)
    assembly_name = os.path.splitext(secure_filename(file.filename))[0]
    cur.execute("INSERT INTO assemblies (assembly_name, last_modified_user) VALUES (?, ?)",
                (assembly_name, "csv_import"))
    assembly_id = cur.lastrowid

    # 부품별로 삽입 or 조회
    for _, row in df.iterrows():
        try:
            part_name = str(row['Parts']).strip()
            description = str(row['Detailed Description']).strip()
            manufacturer = str(row['MANUFACTURER_NAME']).strip()
            package = str(row['Device']).strip()
            category = str(row['CATEGORY']).strip()
            memo = str(row['DESCRIPTION']).strip()
            quantity = int(row['Qty']) if not pd.isnull(row['Qty']) else 1
            reference = str(row['Value']) if not pd.isnull(row['Value']) else ''

            # 부품 존재 여부 확인
            cur.execute("SELECT id FROM parts WHERE part_name = ?", (part_name,))
            existing = cur.fetchone()
            if existing:
                part_id = existing['id']
            else:
                cur.execute("""
                    INSERT INTO parts (
                        part_name, manufacturer, description, package,
                        category_large, memo
                    ) VALUES (?, ?, ?, ?, ?, ?)
                """, (part_name, manufacturer, description, package, category, memo))
                part_id = cur.lastrowid

            # 어셈블리-부품 연결
            cur.execute("""
                INSERT INTO assembly_parts (
                    assembly_id, part_id, quantity_per, reference
                ) VALUES (?, ?, ?, ?)
            """, (assembly_id, part_id, quantity, reference))
        except Exception as row_err:
            print(f"[CSV_ROW_ERROR] 무시된 행: {row.to_dict()}")
            print(row_err)
            continue

    db.commit()
    return jsonify({"message": f"어셈블리 '{assembly_name}' 등록 완료", "assembly_id": assembly_id})

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@assemblies_bp.route('/api/assemblies/<int:assembly_id>/upload-image', methods=['POST'])
def upload_assembly_image(assembly_id):
    if 'image' not in request.files:
        return jsonify({'error': '이미지 파일이 없습니다.'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': '파일명이 없습니다.'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': '허용되지 않는 파일 유형입니다.'}), 400

    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"assembly_{assembly_id}.{ext}"
    save_path = os.path.join(ASSEMBLY_IMAGE_DIR, filename)

    try:
        # 기존 이미지 삭제
        for old in glob.glob(os.path.join(ASSEMBLY_IMAGE_DIR, f"assembly_{assembly_id}.*")):
            os.remove(old)

        file.save(save_path)

        # DB 업데이트
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE assemblies SET image_filename = ? WHERE id = ?", (filename, assembly_id))
        conn.commit()
        conn.close()

        return jsonify({'image_url': f"/static/images/assemblies/{filename}"}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
