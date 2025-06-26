from flask import Blueprint, request, jsonify
from datetime import datetime
import sqlite3
import os
import glob
from werkzeug.utils import secure_filename

parts_bp = Blueprint('parts', __name__)
order_bp = Blueprint('orders', __name__)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'inventory.db')

# 이미지 저장 폴더: 프로젝트 루트/static/images/parts
IMAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static', 'images', 'parts')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
os.makedirs(IMAGE_DIR, exist_ok=True)

def allowed_file(filename):
    """
    업로드된 파일 확장자가 허용 목록에 있는지 검사
    """
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@parts_bp.route('/api/parts', methods=['POST'])
def add_part():
    data = request.get_json()
    print("Received data:", data) 

    if not data.get('part_name') or not data.get('category_large'):
        return jsonify({'error': 'part_name과 category_large는 필수입니다.'}), 400

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO parts (
                part_name, category_large, quantity, ordered_quantity, price,
                manufacturer, value, package, description, last_modified_user,
                create_date, update_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get('part_name'),
            data.get('category_large'),
            data.get('quantity') or 0,
            data.get('ordered_quantity') or 0,
            data.get('price') or 0,
            data.get('manufacturer'),
            data.get('value'),
            data.get('package'),
            data.get('description'),
            data.get('last_modified_user') or "Unknown",
            datetime.now(),
            datetime.now()
        ))

        conn.commit()
        conn.close()
        return jsonify({'message': '부품이 성공적으로 추가되었습니다.'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': '이미 존재하는 부품 이름입니다.'}), 409
    except Exception as e:
        print("Error in add_part:", e)  # 에러 로그 출력
        return jsonify({'error': str(e)}), 500

@parts_bp.route('/api/parts', methods=['GET'])
def get_parts():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM parts ORDER BY update_date DESC")
        rows = cursor.fetchall()

        parts = []
        for row in rows:
            part_dict = dict(row)

            # image_url 필드 추가
            if part_dict.get('image_filename'):
                part_dict['image_url'] = f"/static/images/parts/{part_dict['image_filename']}"
            else:
                part_dict['image_url'] = None

            parts.append(part_dict)

        conn.close()
        return jsonify(parts)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@parts_bp.route('/api/categories/large', methods=['GET'])
def get_large_categories():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("SELECT DISTINCT category_large FROM parts WHERE category_large IS NOT NULL")
        rows = cursor.fetchall()

        categories = [row[0] for row in rows if row[0]]
        return jsonify(categories)

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@parts_bp.route('/api/categories/medium', methods=['GET'])
def get_medium_categories():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("SELECT DISTINCT category_medium FROM parts WHERE category_medium IS NOT NULL")
        rows = cursor.fetchall()

        categories = [row[0] for row in rows if row[0]]
        return jsonify(categories)

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@parts_bp.route('/api/categories/small', methods=['GET'])
def get_small_categories():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("SELECT DISTINCT category_small FROM parts WHERE category_small IS NOT NULL")
        rows = cursor.fetchall()

        categories = [row[0] for row in rows if row[0]]
        return jsonify(categories)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@parts_bp.route('/api/parts', methods=['DELETE'])
def delete_parts():
    data = request.get_json()
    ids = data.get('ids', [])

    if not ids:
        return jsonify({'error': '삭제할 ID가 없습니다.'}), 400
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        # 이미지 파일 삭제
        for part_id in ids:
            pattern = os.path.join(IMAGE_DIR, f"part_{part_id}.*")
            for file in glob.glob(pattern):
                os.remove(file)

        cursor.executemany("DELETE FROM parts WHERE id = ?", [(i,) for i in ids])
        conn.commit()
        conn.close()

        return jsonify({'message': f'{len(ids)}개 부품 삭제됨'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@parts_bp.route('/api/parts/<int:part_id>', methods=['GET'])
def get_part_detail(part_id):
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM parts WHERE id = ?", (part_id,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return jsonify({'error': '해당 부품을 찾을 수 없습니다.'}), 404

        part_dict = dict(row)

        # 이미지 URL 생성 (image_filename이 있을 때만)
        if part_dict.get('image_filename'):
            part_dict['image_url'] = f"/static/images/parts/{part_dict['image_filename']}"
        else:
            part_dict['image_url'] = None

        return jsonify(part_dict)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# -------------------------------------------------------
# 8. 부품 정보 수정 (텍스트 필드만) 
# -------------------------------------------------------
@parts_bp.route('/api/parts/<int:part_id>', methods=['PUT'])
def update_part(part_id):
    data = request.get_json()

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE parts SET
                part_name = ?,
                category_large = ?,
                category_medium = ?,
                category_small = ?,
                quantity = ?,
                ordered_quantity = ?,
                price = ?,
                manufacturer = ?,
                value = ?,
                package = ?,
                mounting_type = ?,
                location = ?,
                memo = ?,
                description = ?,
                update_date = ?,
                last_modified_user = ?,
                purchase_url = ?
            WHERE id = ?
        """, (
            data.get('part_name'),
            data.get('category_large'),
            data.get('category_medium'),
            data.get('category_small'),
            data.get('quantity') or 0,
            data.get('ordered_quantity') or 0,
            data.get('price') or 0,
            data.get('manufacturer'),
            data.get('value'),
            data.get('package'),
            data.get('mounting_type'),
            data.get('location'),
            data.get('memo'),
            data.get('description'),
            datetime.now(),
            data.get('last_modified_user') or "Unknown",
            data.get('purchase_url'),
            part_id
        ))

        conn.commit()
        conn.close()

        return jsonify({'message': '부품 정보가 수정되었습니다.'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@parts_bp.route('/api/parts/<int:part_id>/upload-image', methods=['POST'])
def upload_part_image(part_id):
    """
    클라이언트에서 multipart/form-data로 'image' 필드를 보내면,
    part_{id}.확장자 형태로 저장하고 DB에 image_filename 컬럼으로 기록
    """
    if 'image' not in request.files:
        return jsonify({'error': '업로드할 이미지 파일이 없습니다.'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': '파일명이 비어 있습니다.'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': '허용되지 않는 파일 확장자입니다.'}), 400

    # 확장자 추출
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"part_{part_id}.{ext}"
    save_path = os.path.join(IMAGE_DIR, filename)

    try:
        # 기존 이미지 삭제
        existing_images = glob.glob(os.path.join(IMAGE_DIR, f"part_{part_id}.*"))
        for img in existing_images:
            os.remove(img)

        file.save(save_path)

        # DB에 파일명 기록
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE parts SET image_filename = ? WHERE id = ?", (filename, part_id))
        conn.commit()
        conn.close()

        image_url = f"/static/images/parts/{filename}"
        return jsonify({'image_url': image_url}), 200

    except Exception as e:
        return jsonify({'error': f"이미지 저장 또는 DB 업데이트 실패: {str(e)}"}), 500

@order_bp.route('/api/parts/<int:part_id>/orders', methods=['GET'])
def get_orders_by_part(part_id):
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        cur.execute("""
            SELECT id, part_id, order_date, quantity_ordered
            FROM part_orders
            WHERE part_id = ?
            ORDER BY order_date DESC
        """, (part_id,))

        rows = cur.fetchall()
        orders = [dict(row) for row in rows]

        return jsonify(orders), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500    

@order_bp.route('/api/part_orders', methods=['POST'])
def create_or_merge_order():
    data = request.get_json()
    print("[POST] /api/part_orders - 받은 데이터:", data)
    part_id = data['part_id']
    order_date = data['order_date']
    qty = data['quantity_ordered']

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, quantity_ordered FROM part_orders
        WHERE part_id = ? AND order_date = ?
    """, (part_id, order_date))
    existing = cur.fetchone()

    if existing:
        new_qty = existing['quantity_ordered'] + qty
        cur.execute("UPDATE part_orders SET quantity_ordered = ? WHERE id = ?", (new_qty, existing['id']))
    else:
        cur.execute("""
            INSERT INTO part_orders (part_id, order_date, quantity_ordered)
            VALUES (?, ?, ?)
        """, (part_id, order_date, qty))

    conn.commit()
    return jsonify({"success": True})

@order_bp.route('/api/part_orders/<int:order_id>/fulfill', methods=['PATCH'])
def fulfill_part_order(order_id):
    try:
        conn = get_db()
        cur = conn.cursor()

        # 주문 수량 및 부품 ID 조회
        cur.execute("""
            SELECT part_id, quantity_ordered
            FROM part_orders
            WHERE id = ?
        """, (order_id,))
        row = cur.fetchone()

        if not row:
            return jsonify({'error': '해당 주문을 찾을 수 없습니다.'}), 404

        part_id = row['part_id']
        qty = row['quantity_ordered']

        # 부품 재고 증가
        cur.execute("""
            UPDATE parts
            SET quantity = quantity + ?
            WHERE id = ?
        """, (qty, part_id))

        # 주문 삭제 (원한다면)
        cur.execute("DELETE FROM part_orders WHERE id = ?", (order_id,))

        conn.commit()
        return jsonify({'message': '배송 완료 처리 및 재고 반영 완료'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@parts_bp.route('/api/assemblies/<int:assembly_id>/bom/<int:part_id>/allocate', methods=['PUT'])
def allocate_part(assembly_id, part_id):
    data = request.get_json()
    amount = data.get('amount')

    if not isinstance(amount, int) or amount <= 0:
        return jsonify({'error': '양수인 할당 수량을 입력해야 합니다.'}), 400

    conn = get_db()
    cur = conn.cursor()

    # 부품 수량, 현재 할당량, 필요 수량 확인
    cur.execute("""
        SELECT p.quantity, ap.allocated_quantity, ap.quantity_per, a.quantity_to_build
        FROM parts p
        JOIN assembly_parts ap ON p.id = ap.part_id
        JOIN assemblies a ON ap.assembly_id = a.id
        WHERE ap.assembly_id = ? AND ap.part_id = ?
    """, (assembly_id, part_id))
    row = cur.fetchone()

    if not row:
        return jsonify({'error': '해당 부품이 어셈블리에 존재하지 않습니다.'}), 404

    part_qty = row['quantity']
    allocated = row['allocated_quantity'] or 0
    quantity_per = row['quantity_per']
    to_build = row['quantity_to_build']
    required_total = quantity_per * to_build

    if amount > part_qty:
        return jsonify({'error': '재고보다 많은 양을 할당할 수 없습니다.'}), 400
    if allocated + amount > required_total:
        return jsonify({'error': '필요 수량보다 많은 할당은 불가능합니다.'}), 400

    # 할당 처리
    cur.execute("""
        UPDATE assembly_parts
        SET allocated_quantity = allocated_quantity + ?
        WHERE assembly_id = ? AND part_id = ?
    """, (amount, assembly_id, part_id))

    cur.execute("""
        UPDATE parts
        SET quantity = quantity - ?
        WHERE id = ?
    """, (amount, part_id))

    conn.commit()
    return jsonify({'success': True}), 200


@parts_bp.route('/api/assemblies/<int:assembly_id>/bom/<int:part_id>/deallocate', methods=['PUT'])
def deallocate_part(assembly_id, part_id):
    data = request.get_json()
    amount = data.get('amount')

    if not isinstance(amount, int) or amount <= 0:
        return jsonify({'error': '양수인 취소 수량을 입력해야 합니다.'}), 400

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT allocated_quantity
        FROM assembly_parts
        WHERE assembly_id = ? AND part_id = ?
    """, (assembly_id, part_id))
    row = cur.fetchone()

    if not row:
        return jsonify({'error': '해당 부품이 어셈블리에 존재하지 않습니다.'}), 404

    allocated = row['allocated_quantity'] or 0

    if amount > allocated:
        return jsonify({'error': '할당된 수량보다 많이 취소할 수 없습니다.'}), 400

    # 할당 취소 처리
    cur.execute("""
        UPDATE assembly_parts
        SET allocated_quantity = allocated_quantity - ?
        WHERE assembly_id = ? AND part_id = ?
    """, (amount, assembly_id, part_id))

    cur.execute("""
        UPDATE parts
        SET quantity = quantity + ?
        WHERE id = ?
    """, (amount, part_id))

    conn.commit()
    return jsonify({'success': True}), 200

@parts_bp.route("/api/part_orders/recent", methods=["GET"])
def get_recent_part_orders():
    try:
        db = get_db()
        rows = db.execute("""
            SELECT po.id, po.order_date, po.quantity_ordered,
                   p.part_name
            FROM part_orders po
            JOIN parts p ON po.part_id = p.id
            ORDER BY po.order_date DESC
            LIMIT 10
        """).fetchall()
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        current_app.logger.error(f"Error fetching part orders: {e}")
        return jsonify({'error': str(e)}), 500
