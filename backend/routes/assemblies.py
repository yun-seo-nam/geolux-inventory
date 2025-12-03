# backend/routes/assemblies.py
from flask import Blueprint, request, jsonify, g, current_app
import sqlite3
import os
import pandas as pd
from werkzeug.utils import secure_filename
import glob
from collections import defaultdict
import traceback
import re, unicodedata  # ← 필요 임포트

# CORS (블루프린트 레벨)
from flask_cors import CORS

assemblies_bp = Blueprint('assemblies', __name__)
CORS(assemblies_bp, resources={r"/api/*": {
    "origins": ["http://192.168.0.2:3000", "http://localhost:3000"]
}})

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

def canon_compare_py(s: str) -> str:
    s = '' if s is None else str(s)
    s = re.sub(r'[\u2010\u2011\u2012\u2013\u2014\u2212]', '-', s)
    s = unicodedata.normalize('NFKC', s).strip().lower()
    s = re.sub(r'\s+', ' ', s)
    s = s.replace('_', ' ')
    s = re.sub(r'\s*-\s*', '-', s)
    return s

def sanitize_token_py(s: str) -> str:
    s = str(s or '').strip()
    s = re.sub(r'\s+', ' ', s)
    s = re.sub(r'[\/\\:*?"<>|]', '', s)
    return s.replace(' ', '_')

def parse_qty_py(v):
    try:
        if pd.isnull(v): return 0
    except Exception:
        pass
    s = str(v)
    m = re.search(r'-?\d+(?:[,\s]?\d+)*', s)
    if not m: return 0
    return int(m.group(0).replace(',', '').replace(' ', ''))

def pick(colset, names):
    for n in names:
        if n in colset:
            return n
    return None

@assemblies_bp.route("/api/assemblies/upload_csv", methods=["POST", "OPTIONS"])
def upload_assembly_csv():
    if request.method == "OPTIONS":
        return ("", 204)

    # 파일 존재 확인
    if 'file' not in request.files:
        return jsonify({"error": "CSV 파일이 필요합니다"}), 400

    file = request.files['file']
    if not file.filename.lower().endswith('.csv'):
        return jsonify({"error": "CSV 파일만 업로드 가능합니다"}), 400

    # CSV 읽기 (encoding/sep 유연)
    try:
        file.stream.seek(0)
        try:
            df = pd.read_csv(file, sep=None, engine='python', encoding='utf-8-sig')
        except UnicodeDecodeError:
            file.stream.seek(0)
            try:
                df = pd.read_csv(file, sep=None, engine='python', encoding='utf-8')
            except UnicodeDecodeError:
                file.stream.seek(0)
                df = pd.read_csv(file, sep=None, engine='python', encoding='cp949')
    except Exception as e:
        return jsonify({"error": f"CSV 파싱 오류: {str(e)}"}), 400

    # 컬럼 정규화 (헤더 트림)
    def norm_col(c): return str(c).strip().strip('"').strip()
    df.columns = [norm_col(c) for c in df.columns]
    cols = set(df.columns)

    # 컬럼 매핑(별칭)
    col_part_name   = pick(cols, ['part_name', 'Part Name', 'Part_Name'])
    col_quantity    = pick(cols, ['quantity', 'Qty', 'Quantity'])
    col_reference   = pick(cols, ['reference', 'Parts', 'Ref', 'Designator'])
    col_description = pick(cols, ['description', 'Detailed Description', 'Desc'])
    col_package     = pick(cols, ['package', 'Footprint Name', 'Package'])
    col_device      = pick(cols, ['Device', 'device'])
    col_value       = pick(cols, ['Value', 'value', 'Val', 'Spec'])
    col_mfr         = pick(cols, ['Manufacturer', 'Mfr', 'manufacturer', 'MANUFACTURER_NAME'])
    col_category    = pick(cols, ['CATEGORY', 'category_large', 'category'])

    # 기본 검증
    if not col_quantity:
        return jsonify({"error": "필수 열 누락: quantity/Qty"}), 400

    assembly_name = request.form.get('assembly_name') or os.path.splitext(secure_filename(file.filename))[0]

    db = get_db()
    cur = db.cursor()

    # 중복 어셈블리명 방지
    cur.execute("SELECT id FROM assemblies WHERE assembly_name = ?", (assembly_name,))
    if cur.fetchone():
        return jsonify({"error": f"이미 존재하는 어셈블리 이름입니다: {assembly_name}"}), 400

    # 어셈블리 생성
    cur.execute("INSERT INTO assemblies (assembly_name, create_date, update_date) VALUES (?, datetime('now'), datetime('now'))", (assembly_name,))
    assembly_id = cur.lastrowid

    grouped_parts = defaultdict(lambda: {"quantity": 0, "reference": [], "row": None})
    skipped_empty = 0
    skipped_zero = 0
    failed_rows = []

    # 행 처리
    for idx, row in df.iterrows():
        # part_name 우선
        pn = ""
        if col_part_name and col_part_name in row and pd.notna(row[col_part_name]):
            pn = str(row[col_part_name]).strip()

        # part_name이 비어있으면 device/value 규칙 적용 (DB 저장엔 쓰지 않음)
        if not pn:
            device_raw = (str(row[col_device]).strip() if col_device and col_device in row and pd.notna(row[col_device]) else "")
            value_raw  = (str(row[col_value]).strip()  if col_value  and col_value  in row and pd.notna(row[col_value])  else "")

            dev_norm = canon_compare_py(device_raw)
            val_norm = canon_compare_py(value_raw)
            device_tok = sanitize_token_py(device_raw)
            value_tok  = sanitize_token_py(value_raw)

            base = ""
            if dev_norm and val_norm:
                if (dev_norm == val_norm) or (re.sub(r'[^a-z0-9]', '', dev_norm) == re.sub(r'[^a-z0-9]', '', val_norm)):
                    base = device_tok
                else:
                    base = f"{device_tok}_{value_tok}"
            elif dev_norm:
                base = device_tok
            elif val_norm:
                base = value_tok
            else:
                # 둘 다 없으면 reference로 대체
                ref_raw = (str(row[col_reference]).strip() if col_reference and col_reference in row and pd.notna(row[col_reference]) else "")
                base = sanitize_token_py(ref_raw)

            pn = base

        # 비어 있으면 스킵/실패 기록
        if not pn:
            if all((not pd.notna(row[c]) or str(row[c]).strip() == "") for c in df.columns):
                skipped_empty += 1
                continue
            else:
                failed_rows.append((int(idx) + 2, "part_name empty"))
                continue

        # quantity 파싱
        raw_q = row[col_quantity] if col_quantity in row else None
        try:
            qty = int(float(raw_q)) if (raw_q is not None and not pd.isnull(raw_q)) else 0
        except Exception:
            qty = parse_qty_py(raw_q)
        if not qty:
            skipped_zero += 1
            continue

        # reference 처리
        ref = ""
        if col_reference and col_reference in row and pd.notna(row[col_reference]):
            ref = str(row[col_reference]).strip()
        refs = [r.strip() for chunk in str(ref).split(';') for r in chunk.split(',') if r and r.strip()]

        grouped_parts[pn]["quantity"] += qty
        grouped_parts[pn]["reference"].extend(refs)
        grouped_parts[pn]["row"] = row

    # DB 반영 (value는 절대 저장X)
    inserted = 0
    for part_name, data in grouped_parts.items():
        row = data["row"]
        quantity = data["quantity"]
        reference = ', '.join(data["reference"])

        def get_opt(col):
            return (str(row[col]).strip() if (col and col in row and pd.notna(row[col])) else "")

        description = get_opt(col_description)
        manufacturer = get_opt(col_mfr)
        package = get_opt(col_package) or part_name
        category = get_opt(col_category)
        memo = ""

        try:
            # parts upsert (part_name 기준)
            cur.execute("SELECT id FROM parts WHERE part_name = ?", (part_name,))
            existing = cur.fetchone()
            if existing:
                part_id = existing['id']
            else:
                cur.execute("""
                    INSERT INTO parts (
                        part_name, manufacturer, description, package,
                        category_large, memo, create_date, update_date
                    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                """, (part_name, manufacturer, description, package, category, memo))
                part_id = cur.lastrowid

            cur.execute("""
                INSERT INTO assembly_parts (assembly_id, part_id, quantity_per, reference)
                VALUES (?, ?, ?, ?)
            """, (assembly_id, part_id, quantity, reference))
            inserted += 1
        except Exception as e:
            failed_rows.append((int(getattr(row, 'name', 0)) + 2, str(e)))
            continue

    # 상태 갱신 및 커밋
    try:
        recalculate_assembly_status(db, assembly_id)
        db.commit()
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"DB 커밋 실패: {str(e)}"}), 500

    result = {
        "message": f"어셈블리 '{assembly_name}' 등록 완료",
        "assembly_id": assembly_id,
        "inserted": inserted
    }
    if skipped_empty or skipped_zero:
        result["warnings"] = f"빈행 {skipped_empty}건, 수량 0 행 {skipped_zero}건 스킵"
    if failed_rows:
        result["warnings"] = (result.get("warnings", "") + f" 실패 {len(failed_rows)}건").strip() if result.get("warnings") else f"실패 {len(failed_rows)}건"
        result["failed_rows"] = failed_rows

    return jsonify(result), 200

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
                ap.reference, 
                ap.quantity_per, 
                ap.allocated_quantity, 
                p.part_name, 
                p.quantity, 
                p.package, 
                p.id as part_id,
                al.alias_id,   
                a.alias_name      
            FROM assembly_parts ap
            JOIN parts p ON ap.part_id = p.id
            LEFT JOIN alias_links al ON p.id = al.part_id  
            LEFT JOIN aliases a ON al.alias_id = a.id     
            WHERE ap.assembly_id = ?
            ORDER BY p.part_name
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
    work_date = data.get('work_date')  # "YYYY-MM-DD"
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
                    category_large, memo, 
                    create_date, update_date
                ) VALUES (?, '', '', '', '', '', datetime('now'), datetime('now'))
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

        cur.execute(f"UPDATE assemblies SET {sets} WHERE id=?", values)
        db.commit()

        row = db.execute("SELECT * FROM assemblies WHERE id=?", (assembly_id,)).fetchone()
        if not row:
            return jsonify({"error":"Assembly not found"}), 404

        return jsonify(dict(row)), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# 스왑 관련
@assemblies_bp.route('/api/assemblies/<int:asm_id>/bom/<int:old_pid>/swap', methods=['PUT'])
def swap_bom_part(asm_id, old_pid):
    """
    assembly_parts에서 해당 행을 삭제하지 않고 part_id만 new_part_id로 교체한다.
    - (assembly_id, new_part_id) 조합이 이미 있으면 409 반환
    - allocated_quantity 등은 assembly_parts 컬럼에 그대로 보존
    """
    try:
        data = request.get_json(silent=True) or {}
        new_pid = data.get("new_part_id")
        if new_pid is None:
            return jsonify({"error": "new_part_id required"}), 400
        try:
            new_pid = int(new_pid)
        except Exception:
            return jsonify({"error": "new_part_id must be int"}), 400

        if int(new_pid) == int(old_pid):
            return jsonify({"error": "same_part"}), 400

        db = get_db()
        cur = db.cursor()

        # (옵션) FK 강제
        try:
            cur.execute("PRAGMA foreign_keys = ON")
        except Exception:
            pass

        # 쓰기 트랜잭션
        cur.execute("BEGIN IMMEDIATE")

        # 0) 기존 행 존재 확인
        row_old = cur.execute(
            "SELECT 1 FROM assembly_parts WHERE assembly_id=? AND part_id=?",
            (asm_id, old_pid)
        ).fetchone()
        if not row_old:
            db.rollback()
            return jsonify({"error": "assembly_part_not_found"}), 404

        # 1) 새 대상이 이미 있으면 중복
        dup = cur.execute(
            "SELECT 1 FROM assembly_parts WHERE assembly_id=? AND part_id=?",
            (asm_id, new_pid)
        ).fetchone()
        if dup:
            db.rollback()
            return jsonify({"error": "duplicate_bom_row"}), 409

        # 2) 스왑 (삭제 없이 in-place로 part_id만 교체)
        cur.execute(
            """
            UPDATE assembly_parts
            SET part_id=?, update_date=CURRENT_TIMESTAMP
            WHERE assembly_id=? AND part_id=?
            """,
            (new_pid, asm_id, old_pid)
        )

        db.commit()
        return jsonify({
            "ok": True,
            "assembly_id": asm_id,
            "old_part_id": int(old_pid),
            "new_part_id": int(new_pid)
        }), 200

    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    
@assemblies_bp.route("/api/assemblies/<int:assembly_id>/bom/swap-quantity", methods=["POST"])
def swap_bom_quantity(assembly_id):
    """
    [Logic Fixed]
    1. Target(B) 부품: 그냥 수량만 늘려줌 (자동 할당 X)
    2. Source(A) 부품: 수량이 줄어들었을 때, '필요량보다 더 많이 할당된 경우'에만 차액을 반납
    """
    data = request.get_json(silent=True) or {}
    src_part_id = data.get("source_part_id")
    tgt_part_id = data.get("target_part_id")
    swap_qty = int(data.get("swap_quantity", 0))

    if not src_part_id or not tgt_part_id or swap_qty <= 0:
        return jsonify({"error": "잘못된 요청 데이터입니다."}), 400

    db = get_db()
    cursor = db.cursor()

    try:
        # 0. 총 몇 대를 만드는지 확인 (필요량 계산을 위해)
        assembly = cursor.execute(
            "SELECT quantity_to_build FROM assemblies WHERE id=?", 
            (assembly_id,)
        ).fetchone()
        if not assembly:
            return jsonify({"error": "어셈블리 정보 없음"}), 404
        
        build_qty = assembly["quantity_to_build"] # 예: 4대

        # 1. Source(A) 정보 조회
        src_row = cursor.execute("""
            SELECT quantity_per, allocated_quantity 
            FROM assembly_parts 
            WHERE assembly_id=? AND part_id=?
        """, (assembly_id, src_part_id)).fetchone()

        if not src_row:
            return jsonify({"error": "기존 부품이 BOM에 없습니다."}), 404

        current_src_qty_per = src_row["quantity_per"]     # 예: 3개
        src_allocated = src_row["allocated_quantity"] or 0 # 예: 12개

        if swap_qty > current_src_qty_per:
            return jsonify({"error": "교체 수량이 현재 수량보다 많습니다."}), 400

        # ==========================================================
        # [STEP 1] Target(B) 처리 - 단순히 수량만 추가 (할당 X)
        # ==========================================================
        tgt_row = cursor.execute("""
            SELECT quantity_per 
            FROM assembly_parts 
            WHERE assembly_id=? AND part_id=?
        """, (assembly_id, tgt_part_id)).fetchone()

        if tgt_row:
            cursor.execute("""
                UPDATE assembly_parts 
                SET quantity_per = quantity_per + ? 
                WHERE assembly_id=? AND part_id=?
            """, (swap_qty, assembly_id, tgt_part_id))
        else:
            # 새로 추가되는 경우 할당량은 0으로 시작
            cursor.execute("""
                INSERT INTO assembly_parts (assembly_id, part_id, quantity_per, reference, allocated_quantity)
                VALUES (?, ?, ?, '', 0)
            """, (assembly_id, tgt_part_id, swap_qty))

        # ==========================================================
        # [STEP 2] Source(A) 처리 - 줄어든 만큼 과잉 할당 반납
        # ==========================================================
        new_src_qty_per = current_src_qty_per - swap_qty # 예: 3 - 1 = 2개
        
        if new_src_qty_per > 0:
            # 부분 교체 상황 (예: 3개 -> 2개)
            
            # 이제 실제로 필요한 총 수량 계산
            # 예: 2개 * 4대 = 8개 필요
            new_needed_total = new_src_qty_per * build_qty
            
            # 현재 할당된 게 필요량보다 많은가? (예: 12개 > 8개)
            if src_allocated > new_needed_total:
                # 과잉분 계산: 12 - 8 = 4개
                return_to_stock = src_allocated - new_needed_total
                
                # 1) 재고로 반납
                cursor.execute("UPDATE parts SET quantity = quantity + ? WHERE id = ?", (return_to_stock, src_part_id))
                
                # 2) BOM 할당량 줄임 (딱 필요한 만큼만 남김)
                cursor.execute("""
                    UPDATE assembly_parts 
                    SET quantity_per = ?, allocated_quantity = ?
                    WHERE assembly_id=? AND part_id=?
                """, (new_src_qty_per, new_needed_total, assembly_id, src_part_id))
            else:
                # 할당된 게 필요량보다 적거나 같으면, 그냥 BOM 수량만 줄임 (재고 반납 X)
                cursor.execute("""
                    UPDATE assembly_parts 
                    SET quantity_per = ?
                    WHERE assembly_id=? AND part_id=?
                """, (new_src_qty_per, assembly_id, src_part_id))

        else:
            # 전체 교체 상황 (A가 아예 사라짐)
            # 할당되어 있던 모든 수량을 재고로 반납
            if src_allocated > 0:
                cursor.execute("UPDATE parts SET quantity = quantity + ? WHERE id = ?", (src_allocated, src_part_id))
            
            # BOM 행 삭제
            cursor.execute("DELETE FROM assembly_parts WHERE assembly_id=? AND part_id=?", (assembly_id, src_part_id))

        db.commit()
        return jsonify({"message": "교체 완료 (과잉 할당분 반납됨)"})

    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500