from flask import Blueprint, request, jsonify, g, current_app
import sqlite3
import os
import pandas as pd
from werkzeug.utils import secure_filename
import glob
from collections import defaultdict
import traceback

assemblies_bp = Blueprint('assemblies', __name__)

DB_PATH = os.path.join(os.getcwd(), 'inventory.db')
ASSEMBLY_IMAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static', 'images', 'assemblies')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
os.makedirs(ASSEMBLY_IMAGE_DIR, exist_ok=True)

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@assemblies_bp.route("/api/assemblies/create", methods=["POST"])
def create_assembly():
    data = request.get_json(silent=True) or {}
    name = (data.get("assembly_name") or "").strip()

    # 수량 파싱: 기본 1, 정수, 최소 1
    raw_amount = data.get("quantity_to_build", 1)
    try:
        amount = int(raw_amount)
    except (TypeError, ValueError):
        amount = 1
    if amount < 1:
        amount = 1

    if not name:
        return jsonify({"error": "어셈블리 이름이 필요합니다"}), 400

    db = get_db()
    cur = db.cursor()

    cur.execute("SELECT id FROM assemblies WHERE assembly_name = ?", (name,))
    if cur.fetchone():
        return jsonify({"error": "이미 존재하는 이름입니다"}), 400

    cur.execute(
        """
        INSERT INTO assemblies (assembly_name, quantity_to_build, create_date, update_date)
        VALUES (?, ?, datetime('now'), datetime('now'))
        """,
        (name, amount),
    )
    db.commit()

    return jsonify({"message": f"{name} 생성 완료", "assembly_id": cur.lastrowid})

@assemblies_bp.route("/api/assemblies", methods=["GET"])
def get_assemblies():
    try:
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
    except Exception as e:
        current_app.logger.error(f"Error fetching assemblies: {e}")
        return jsonify({'error': str(e)}), 500

@assemblies_bp.route('/api/assemblies', methods=['DELETE'])
def delete_assemblies():
    data = request.get_json()
    ids = data.get('ids', [])

    if not ids:
        return jsonify({'error': '삭제할 ID가 없습니다.'}), 400

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        for assembly_id in ids:
            pattern = os.path.join(ASSEMBLY_IMAGE_DIR, f"assembly_{assembly_id}.*")
            for file in glob.glob(pattern):
                os.remove(file)

            cursor.execute("DELETE FROM assembly_parts WHERE assembly_id = ?", (assembly_id,))

        cursor.executemany("DELETE FROM assemblies WHERE id = ?", [(i,) for i in ids])
        conn.commit()
        conn.close()

        return jsonify({'message': f'{len(ids)}개 어셈블리 삭제됨'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

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

    required_cols = [
        'Qty', 'Value', 'Device', 'Parts',
        'Detailed Description', 'CATEGORY',
        'DESCRIPTION', 'MANUFACTURER_NAME'
    ]
    for col in required_cols:
        if col not in df.columns:
            return jsonify({"error": f"필수 열 누락: {col}"}), 400

    db = get_db()
    cur = db.cursor()

    assembly_name = os.path.splitext(secure_filename(file.filename))[0]

    cur.execute("SELECT id FROM assemblies WHERE assembly_name = ?", (assembly_name,))
    if cur.fetchone():
        return jsonify({"error": f"이미 존재하는 어셈블리 이름입니다: {assembly_name}"}), 400

    cur.execute("""
        INSERT INTO assemblies (assembly_name, create_date, update_date)
        VALUES (?, datetime('now'), datetime('now'))
    """, (assembly_name,))

    assembly_id = cur.lastrowid

    grouped_parts = defaultdict(lambda: {
        "quantity": 0,
        "reference": [],
        "row": None
    })

    for idx, row in df.iterrows():
        part_name = str(row['Device']).strip()
        if not part_name:
            continue

        try:
            qty = int(float(row['Qty'])) if not pd.isnull(row['Qty']) else 1
        except:
            qty = 1

        ref = str(row['Parts']).strip() if not pd.isnull(row['Parts']) else ''
        ref_list = [r.strip() for r in ref.split(',') if r.strip()]

        grouped_parts[part_name]["quantity"] += qty
        grouped_parts[part_name]["reference"].extend(ref_list)
        grouped_parts[part_name]["row"] = row

    failed_rows = []

    for part_name, data in grouped_parts.items():
        row = data["row"]
        quantity = data["quantity"]
        reference = ', '.join(data["reference"])

        description = str(row['Detailed Description']).strip() if not pd.isnull(row['Detailed Description']) else ''
        manufacturer = str(row['MANUFACTURER_NAME']).strip() if not pd.isnull(row['MANUFACTURER_NAME']) else ''
        package = part_name
        category = str(row['CATEGORY']).strip() if not pd.isnull(row['CATEGORY']) else ''
        memo = str(row['DESCRIPTION']).strip() if not pd.isnull(row['DESCRIPTION']) else ''
        value = str(row['Value']).strip() if not pd.isnull(row['Value']) else ''

        try:
            cur.execute("SELECT id FROM parts WHERE part_name = ?", (part_name,))
            existing = cur.fetchone()
            if existing:
                part_id = existing['id']
            else:
                cur.execute("""
                    INSERT INTO parts (
                        part_name, manufacturer, description, package,
                        category_large, memo, value,
                        create_date, update_date
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                """, (
                    part_name, manufacturer, description, package,
                    category, memo, value
                ))
                part_id = cur.lastrowid

            cur.execute("""
                INSERT INTO assembly_parts (
                    assembly_id, part_id, quantity_per, reference
                ) VALUES (?, ?, ?, ?)
            """, (assembly_id, part_id, quantity, reference))

        except Exception as e:
            failed_rows.append((row.name + 2, str(e)))
            continue
    recalculate_assembly_status(db, assembly_id)
    db.commit()

    result = {
        "message": f"어셈블리 '{assembly_name}' 등록 완료",
        "assembly_id": assembly_id
    }
    if failed_rows:
        result["warnings"] = f"{len(failed_rows)}개 행 삽입 실패"
        result["failed_rows"] = failed_rows

    return jsonify(result)

@assemblies_bp.route('/api/assemblies/<int:assembly_id>/upload-image', methods=['POST'])
def upload_assembly_image(assembly_id):
    if 'image' not in request.files:
        return jsonify({'error': '업로드할 이미지 파일이 없습니다.'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': '파일명이 비어 있습니다.'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': '허용되지 않는 파일 확장자입니다.'}), 400

    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"assembly_{assembly_id}.{ext}"
    save_path = os.path.join(ASSEMBLY_IMAGE_DIR, filename)

    try:
        existing_images = glob.glob(os.path.join(ASSEMBLY_IMAGE_DIR, f"assembly_{assembly_id}.*"))
        for img in existing_images:
            os.remove(img)

        file.save(save_path)

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE assemblies SET image_filename = ? WHERE id = ?", (filename, assembly_id))
        conn.commit()
        conn.close()

        image_url = f"/static/images/assemblies/{filename}"
        return jsonify({'image_url': image_url}), 200

    except Exception as e:
        return jsonify({'error': f"이미지 저장 또는 DB 업데이트 실패: {str(e)}"}), 500

@assemblies_bp.route('/api/assemblies/<int:assembly_id>/detail', methods=['GET'])
def get_assembly_detail(assembly_id):
    try:
        db = get_db()
        assembly = db.execute("SELECT * FROM assemblies WHERE id = ?", (assembly_id,)).fetchone()
        if not assembly:
            return jsonify({'error': 'Assembly not found'}), 404

        parts = db.execute("""
            SELECT 
                ap.reference, ap.quantity_per, ap.allocated_quantity, p.part_name, p.quantity, p.id as part_id
            FROM assembly_parts ap
            JOIN parts p ON ap.part_id = p.id
            WHERE ap.assembly_id = ?
        """, (assembly_id,)).fetchall()

        return jsonify({
            'assembly': dict(assembly),
            'parts': [dict(row) for row in parts]
        })

    except Exception as e:
        current_app.logger.error(f"Error fetching assembly detail: {e}")
        return jsonify({'error': str(e)}), 500
    
@assemblies_bp.route('/api/assemblies/<int:assembly_id>/edit', methods=['PUT'])
def edit_assembly_basic_info(assembly_id):
    data = request.get_json()
    assembly_name = data.get('assembly_name')
    quantity_to_build = data.get('quantity_to_build')
    version = data.get('version')
    description = data.get('description')
    manufacturing_method = data.get('manufacturing_method')
    work_date = data.get('work_date')  # "YYYY-MM-DD" 형식 문자열
    work_duration = data.get('work_duration')
    is_soldered = data.get('is_soldered')
    is_tested = data.get('is_tested')    

    db = get_db()
    try:
        if assembly_name is not None:
            db.execute("""
                UPDATE assemblies 
                SET assembly_name = ?, update_date = CURRENT_TIMESTAMP 
                WHERE id = ?""", (assembly_name, assembly_id))
        
        if quantity_to_build is not None:
            db.execute("""
                UPDATE assemblies 
                SET quantity_to_build = ?, update_date = CURRENT_TIMESTAMP 
                WHERE id = ?""", (quantity_to_build, assembly_id))
        
        if version is not None:
            db.execute("""
                UPDATE assemblies 
                SET version = ?, update_date = CURRENT_TIMESTAMP 
                WHERE id = ?""", (version, assembly_id))
        
        if description is not None:
            db.execute("""
                UPDATE assemblies 
                SET description = ?, update_date = CURRENT_TIMESTAMP 
                WHERE id = ?""", (description, assembly_id))
        
        if manufacturing_method is not None:
            db.execute("""
                UPDATE assemblies 
                SET manufacturing_method = ?, update_date = CURRENT_TIMESTAMP 
                WHERE id = ?""", (manufacturing_method, assembly_id))
        
        if work_date is not None:
            db.execute("""
                UPDATE assemblies 
                SET work_date = ?, update_date = CURRENT_TIMESTAMP 
                WHERE id = ?""", (work_date, assembly_id))
        
        if work_duration is not None:
            db.execute("""
                UPDATE assemblies 
                SET work_duration = ?, update_date = CURRENT_TIMESTAMP 
                WHERE id = ?""", (work_duration, assembly_id))
        
        if is_soldered is not None:
            db.execute("""
                UPDATE assemblies 
                SET is_soldered = ?, update_date = CURRENT_TIMESTAMP 
                WHERE id = ?""", (int(is_soldered), assembly_id))
        
        if is_tested is not None:
            db.execute("""
                UPDATE assemblies 
                SET is_tested = ?, update_date = CURRENT_TIMESTAMP 
                WHERE id = ?""", (int(is_tested), assembly_id))

        db.commit()
        return jsonify({'message': '수정 완료'}), 200
    
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@assemblies_bp.route('/api/assemblies/<int:assembly_id>/bom/<int:part_id>', methods=['PUT'])
def update_bom_item(assembly_id, part_id):
    data = request.get_json()
    reference = data.get('reference')
    quantity_per = data.get('quantity_per')

    if reference is None or quantity_per is None:
        return jsonify({'error': '필수 항목 누락'}), 400

    db = get_db()

    try:
        db.execute("""
            UPDATE assembly_parts
            SET reference = ?, quantity_per = ?, update_date = CURRENT_TIMESTAMP
            WHERE assembly_id = ? AND part_id = ?
        """, (reference, quantity_per, assembly_id, part_id))
        recalculate_assembly_status(db, assembly_id)
        db.commit()
        return jsonify({'message': 'BOM 항목 수정 완료'}), 200

    except sqlite3.IntegrityError as e:
        db.rollback()
        return jsonify({'error': f"part_name 수정 실패: {str(e)}"}), 400

    except Exception as e:
        db.rollback()
        print("[BOM 수정 오류]", traceback.format_exc())  
        return jsonify({'error': f"서버 오류: {str(e)}"}), 500
    
@assemblies_bp.route('/api/assemblies/<int:assembly_id>/bom/<int:part_id>', methods=['DELETE'])
def delete_bom_item(assembly_id, part_id):
    db = get_db()
    try:
        db.execute("""
            DELETE FROM assembly_parts
            WHERE assembly_id = ? AND part_id = ?
        """, (assembly_id, part_id))
        recalculate_assembly_status(db, assembly_id)
        db.commit()
        return jsonify({'message': 'BOM 항목 삭제 완료'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'error': f'삭제 실패: {str(e)}'}), 500
    
@assemblies_bp.route('/api/assemblies/<int:assembly_id>/bom', methods=['POST'])
def add_bom_item(assembly_id):
    data = request.get_json()
    part_name = data.get('part_name')
    reference = data.get('reference', '')
    quantity_per = data.get('quantity_per', 1)

    if not part_name:
        return jsonify({'error': 'part_name은 필수입니다'}), 400

    db = get_db()

    try:
        # 존재 여부 확인
        cur = db.cursor()
        cur.execute("SELECT id FROM parts WHERE part_name = ?", (part_name,))
        existing = cur.fetchone()

        if existing:
            part_id = existing['id']
        else:
            cur.execute("""
                INSERT INTO parts (
                    part_name, manufacturer, description, package,
                    category_large, memo, value,
                    create_date, update_date
                ) VALUES (?, '', '', '', '', '', '', datetime('now'), datetime('now'))
            """, (part_name,))
            part_id = cur.lastrowid

        # assembly_parts에 연결
        cur.execute("""
            INSERT INTO assembly_parts (
                assembly_id, part_id, quantity_per, reference
            ) VALUES (?, ?, ?, ?)
        """, (assembly_id, part_id, quantity_per, reference))
        recalculate_assembly_status(db, assembly_id)
        db.commit()
        return jsonify({'message': 'BOM 항목 추가 완료'}), 201

    except Exception as e:
        db.rollback()
        return jsonify({'error': f'추가 실패: {str(e)}'}), 500
    
def recalculate_assembly_status(db, assembly_id):
    row = db.execute("""
        SELECT a.quantity_to_build, 
               SUM(ap.quantity_per) as total_needed, 
               SUM(ap.allocated_quantity) as total_allocated
        FROM assemblies a
        JOIN assembly_parts ap ON a.id = ap.assembly_id
        WHERE a.id = ?
        GROUP BY a.id
    """, (assembly_id,)).fetchone()

    if not row:
        return 

    total_required = row['quantity_to_build'] * row['total_needed']
    allocated = row['total_allocated'] or 0
    percent = 0 if total_required == 0 else (allocated / total_required)

    if percent == 1:
        status = 'Completed'
    elif percent > 0:
        status = 'In Progress'
    else:
        status = 'Planned'

    db.execute("UPDATE assemblies SET status = ? WHERE id = ?", (status, assembly_id))
    db.commit()

@assemblies_bp.route("/api/assemblies/low_stock", methods=["GET"])
def get_low_stock_assemblies():
    try:
        db = get_db()
        rows = db.execute("""
            SELECT a.id, a.assembly_name, a.quantity_to_build,
                   SUM(ap.quantity_per) AS total_needed,
                   SUM(ap.allocated_quantity) AS total_allocated
            FROM assemblies a
            JOIN assembly_parts ap ON a.id = ap.assembly_id
            GROUP BY a.id
            HAVING total_allocated < (a.quantity_to_build * total_needed)
            ORDER BY (1.0 * total_allocated / NULLIF(a.quantity_to_build * total_needed, 0)) ASC
        """).fetchall()

        assemblies = []
        for row in rows:
            total_needed = row["quantity_to_build"] * row["total_needed"]
            allocated = row["total_allocated"] or 0
            percent = 0 if total_needed == 0 else (allocated / total_needed * 100)
            assemblies.append({
                "id": row["id"],
                "assembly_name": row["assembly_name"],
                "allocation_percent": percent
            })

        return jsonify(assemblies)
    except Exception as e:
        current_app.logger.error(f"Error fetching low stock assemblies: {e}")
        return jsonify({'error': str(e)}), 500
    
@assemblies_bp.route('/api/assemblies/full/<int:assembly_id>', methods=['PUT'])
def update_assembly_full(assembly_id):
    data = request.get_json() or {}
    if not data:
        return jsonify({"error": "Empty body"}), 400
    try:
        allowed = [
            "assembly_name","quantity_to_build","description","status",
            "image_filename","version","manufacturing_method",
            "work_date","work_duration","is_soldered","is_tested"
        ]
        data = {k: data[k] for k in data if k in allowed}

        # bool -> 0/1
        for k in ("is_soldered","is_tested"):
            if k in data:
                v = data[k]
                if isinstance(v, str):
                    data[k] = 1 if v.lower()=="true" else 0 if v.lower()=="false" else v
                elif isinstance(v, bool):
                    data[k] = 1 if v else 0
        # int
        for k in ("quantity_to_build","work_duration"):
            if k in data and data[k] not in (None, ""):
                try: data[k] = int(data[k])
                except: pass

        db = get_db()
        cur = db.cursor()
        sets = ", ".join([f"{k}=?" for k in data.keys()])
        values = list(data.values())
        sets += ", update_date=datetime('now')"
        values.append(assembly_id)

        print("[DEBUG][asm FULL] SQL:", f"UPDATE assemblies SET {sets} WHERE id=?")
        print("[DEBUG][asm FULL] VAL:", values)

        cur.execute(f"UPDATE assemblies SET {sets} WHERE id=?", values)
        db.commit()
        print("[DEBUG][asm FULL] rowcount:", cur.rowcount)

        row = db.execute("SELECT * FROM assemblies WHERE id=?", (assembly_id,)).fetchone()
        if not row:
            return jsonify({"error":"Assembly not found"}), 404

        return jsonify(dict(row)), 200
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


