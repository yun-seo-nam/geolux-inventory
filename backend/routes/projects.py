# projects.py
from flask import Blueprint, request, jsonify, g
import sqlite3
import os
import traceback

projects_bp = Blueprint('projects', __name__)

# ====== DB 연결 유틸 ======
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, '..', 'inventory.db')  # 상황에 맞게 경로 조정

def get_db():
    if 'db' not in g:
        # check_same_thread=False: 개발 서버 스레드 이슈 방지
        g.db = sqlite3.connect(DB_PATH, check_same_thread=False)
        g.db.row_factory = sqlite3.Row
    return g.db

@projects_bp.teardown_app_request
def close_db(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()

# ====== 공통 헬퍼 ======
def rowdicts(rows):
    return [dict(r) for r in rows]

# ------------------ 프로젝트 ------------------
@projects_bp.route('/api/projects', methods=['GET'])
def get_projects():
    try:
        db = get_db()
        rows = db.execute('SELECT * FROM projects ORDER BY id DESC').fetchall()
        return jsonify(rowdicts(rows)), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch projects'}), 500

@projects_bp.route('/api/projects/<int:project_id>', methods=['GET'])
def get_project_detail(project_id):
    try:
        db = get_db()
        row = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            return jsonify({'error': 'Project not found'}), 404
        return jsonify(dict(row)), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch project details'}), 500

@projects_bp.route('/api/projects', methods=['POST'])
def create_project():
    try:
        data = request.get_json() or {}
        name = (data.get('project_name') or '').strip()
        description = data.get('description', '')

        if not name:
            return jsonify({'error': '프로젝트 이름은 필수입니다.'}), 400

        db = get_db()
        db.execute(
            'INSERT INTO projects (project_name, description) VALUES (?, ?)',
            (name, description,)
        )
        db.commit()
        return jsonify({'message': 'Project created successfully'}), 201
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Failed to create project'}), 500

@projects_bp.route('/api/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    try:
        db = get_db()
        cur = db.cursor()
        hit = cur.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not hit:
            return jsonify({'error': '해당 프로젝트가 존재하지 않습니다'}), 404

        # 연결 관계 먼저 정리(무결성 보장)
        cur.execute("DELETE FROM project_assemblies WHERE project_id = ?", (project_id,))
        cur.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        db.commit()
        return jsonify({'message': f'프로젝트 {project_id} 삭제 완료'}), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': '프로젝트 삭제 중 오류 발생'}), 500

@projects_bp.route('/api/assemblies', methods=['GET'])
def list_assemblies_simple():
    """프론트 검색 모달용(이름/설명 정도만)."""
    try:
        db = get_db()
        rows = db.execute("""
            SELECT id, assembly_name, COALESCE(description, '') AS description
            FROM assemblies
            ORDER BY id DESC
        """).fetchall()
        return jsonify(rowdicts(rows)), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch assemblies'}), 500

@projects_bp.route('/api/projects/<int:project_id>/assemblies/create', methods=['POST'])
def create_assembly_and_add_to_project(project_id):
    """
    이름으로 어셈블리를 만들고(없으면 생성, 있으면 업데이트) 프로젝트에 링크.
    quantity_to_build / description 값을 assemblies에 반영.
    """
    try:
        data = request.get_json() or {}
        name = (data.get("assembly_name") or "").strip()
        qty = int(data.get("quantity_to_build") or 1)
        desc = data.get("description") or ""

        if not name:
            return jsonify({"error": "어셈블리 이름이 필요합니다"}), 400

        db = get_db()
        cur = db.cursor()

        # 동일 이름 존재 여부 확인
        cur.execute("SELECT id FROM assemblies WHERE assembly_name = ?", (name,))
        row = cur.fetchone()

        if row:
            assembly_id = row["id"]
            # 기존 어셈블리 업데이트(수량/설명)
            cur.execute("""
                UPDATE assemblies
                   SET description = COALESCE(NULLIF(?, ''), description),
                       quantity_to_build = COALESCE(?, quantity_to_build),
                       update_date = datetime('now')
                 WHERE id = ?
            """, (desc, qty, assembly_id))
        else:
            # 신규 생성
            cur.execute("""
                INSERT INTO assemblies (assembly_name, description, quantity_to_build, status, create_date, update_date)
                VALUES (?, ?, ?, 'Planned', datetime('now'), datetime('now'))
            """, (name, desc, qty))
            assembly_id = cur.lastrowid

        # 프로젝트-어셈블리 링크(있으면 무시)
        cur.execute("""
            INSERT OR IGNORE INTO project_assemblies (project_id, assembly_id)
            VALUES (?, ?)
        """, (project_id, assembly_id))

        db.commit()
        return jsonify({
            "message": f"{name} 어셈블리 생성/업데이트 및 프로젝트 연결 완료",
            "assembly_id": assembly_id,
            "project_id": project_id
        }), 201
    except Exception:
        traceback.print_exc()
        return jsonify({'error': '어셈블리 생성 또는 프로젝트 연결 실패'}), 500

@projects_bp.route('/api/projects/<int:project_id>/assemblies/link', methods=['POST'])
def link_existing_assembly_to_project(project_id):
    """
    기존 assembly_id를 프로젝트와 연결. (옵션) quantity_to_build 반영.
    """
    try:
        data = request.get_json() or {}
        assembly_id = data.get('assembly_id')
        qty = data.get('quantity_to_build')

        if not assembly_id:
            return jsonify({'error': 'assembly_id가 필요합니다'}), 400

        db = get_db()
        cur = db.cursor()

        cur.execute("SELECT id FROM assemblies WHERE id = ?", (assembly_id,))
        if not cur.fetchone():
            return jsonify({'error': '해당 어셈블리가 존재하지 않습니다'}), 404

        cur.execute("""
            INSERT OR IGNORE INTO project_assemblies (project_id, assembly_id)
            VALUES (?, ?)
        """, (project_id, assembly_id))

        if qty is not None:
            cur.execute("""
                UPDATE assemblies
                   SET quantity_to_build = ?, update_date = datetime('now')
                 WHERE id = ?
            """, (int(qty), assembly_id))

        db.commit()
        return jsonify({'message': '프로젝트에 연결 완료', 'assembly_id': assembly_id}), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': '연결 중 오류 발생'}), 500

@projects_bp.route('/api/projects/<int:project_id>/assemblies/<int:assembly_id>', methods=['DELETE'])
def remove_assembly_from_project(project_id, assembly_id):
    """프로젝트-어셈블리 연결만 제거(어셈블리 행은 보존)."""
    try:
        db = get_db()
        db.execute("""
            DELETE FROM project_assemblies
            WHERE project_id = ? AND assembly_id = ?
        """, (project_id, assembly_id))
        db.commit()
        return jsonify({'message': '연결 제거 완료'}), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': '연결 제거 중 오류 발생'}), 500

# ------------------ 요약 & 부품 ------------------
@projects_bp.route('/api/projects/<int:project_id>/summary', methods=['GET'])
def get_project_summary(project_id):
    """
    assemblies: id, assembly_name, quantity_to_build, status
    orders: 프로젝트 관련 부품 주문
    materials: 프로젝트 전체 관점의 자재 소요/재고/할당
    """
    try:
        db = get_db()

        assemblies = db.execute('''
            SELECT a.id, a.assembly_name, a.quantity_to_build, a.status
            FROM assemblies a
            JOIN project_assemblies pa ON a.id = pa.assembly_id
            WHERE pa.project_id = ?
            ORDER BY a.id DESC
        ''', (project_id,)).fetchall()

        # 이 프로젝트의 어셈블리에 속한 부품들만의 주문
        orders = db.execute('''
            SELECT po.*, p.part_name
              FROM part_orders po
              JOIN parts p ON po.part_id = p.id
             WHERE EXISTS (
                SELECT 1
                  FROM assembly_parts ap
                  JOIN project_assemblies pa ON ap.assembly_id = pa.assembly_id
                 WHERE pa.project_id = ?
                   AND ap.part_id = po.part_id
             )
             ORDER BY po.id DESC
        ''', (project_id,)).fetchall()

        materials = db.execute('''
            SELECT 
              p.id AS part_id,
              p.part_name,
              SUM(ap.quantity_per * a.quantity_to_build) AS total_required,
              p.quantity AS current_stock,
              COALESCE(SUM(ap.allocated_quantity), 0) AS allocated_quantity
            FROM parts p
            JOIN assembly_parts ap ON p.id = ap.part_id
            JOIN assemblies a ON ap.assembly_id = a.id
            JOIN project_assemblies pa ON a.id = pa.assembly_id
            WHERE pa.project_id = ?
            GROUP BY p.id, p.part_name, p.quantity
            ORDER BY p.id DESC
        ''', (project_id,)).fetchall()

        return jsonify({
            'assemblies': rowdicts(assemblies),
            'orders': rowdicts(orders),
            'materials': rowdicts(materials),
        }), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch project summary'}), 500

@projects_bp.route('/api/projects/<int:project_id>/parts', methods=['GET'])
def get_all_project_parts(project_id):
    """프로젝트에 포함된 모든 어셈블리의 부품 상세 목록."""
    try:
        db = get_db()
        rows = db.execute('''
            SELECT
              ap.part_id,
              p.part_name,
              ap.reference,
              ap.quantity_per,
              p.quantity AS stock_quantity,
              ap.allocated_quantity,
              a.id AS assembly_id,
              a.assembly_name,
              a.quantity_to_build
            FROM project_assemblies pa
            JOIN assemblies a       ON pa.assembly_id = a.id
            JOIN assembly_parts ap  ON a.id = ap.assembly_id
            JOIN parts p            ON ap.part_id = p.id
            WHERE pa.project_id = ?
            ORDER BY a.id DESC, p.id DESC
        ''', (project_id,)).fetchall()

        return jsonify(rowdicts(rows)), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch parts for project'}), 500

@projects_bp.route('/api/assemblies/<int:assembly_id>/update', methods=['PUT'])
def update_assembly(assembly_id):
    """
    수량/상태 업데이트: { quantity_to_build?, status? }
    """
    try:
        data = request.get_json() or {}
        qty = data.get('quantity_to_build')
        status = data.get('status')

        if qty is None and status is None:
            return jsonify({'error': '업데이트할 필드가 없습니다'}), 400

        db = get_db()
        cur = db.cursor()

        sets, params = [], []
        if qty is not None:
            sets.append("quantity_to_build = ?")
            params.append(int(qty))
        if status is not None:
            sets.append("status = ?")
            params.append(status)

        sets.append("update_date = datetime('now')")
        params.append(assembly_id)

        cur.execute(f"UPDATE assemblies SET {', '.join(sets)} WHERE id = ?", params)
        if cur.rowcount == 0:
            return jsonify({'error': '해당 어셈블리가 없습니다'}), 404

        db.commit()
        return jsonify({'message': '업데이트 완료'}), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': '업데이트 중 오류 발생'}), 500

@projects_bp.route('/api/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    """
    업데이트 가능한 필드: project_name, description, start_date, end_date
    바디 예: {"description":"새 설명"}
    """
    try:
        data = request.get_json() or {}
        allowed = ['project_name', 'description', 'start_date', 'end_date']
        sets, params = [], []
        for k in allowed:
            if k in data and data[k] is not None:
                sets.append(f"{k} = ?")
                params.append(data[k])

        if not sets:
            return jsonify({'error': '업데이트할 필드가 없습니다'}), 400

        # update_date 자동 갱신
        sets.append("update_date = datetime('now')")
        params.append(project_id)

        db = get_db()
        cur = db.cursor()
        cur.execute(f"UPDATE projects SET {', '.join(sets)} WHERE id = ?", params)
        if cur.rowcount == 0:
            return jsonify({'error': '해당 프로젝트가 없습니다'}), 404

        # 갱신된 행 반환
        row = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        db.commit()
        return jsonify(dict(row)), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': '프로젝트 업데이트 실패'}), 500
    
@projects_bp.route("/api/projects/full/<int:project_id>", methods=["PUT"])
def update_project_full(project_id):
    data = request.get_json() or {}
    if not data:
        return jsonify({"error": "Empty body"}), 400

    try:
        db = get_db()
        cur = db.cursor()

        # body에 들어온 모든 key=value를 그대로 update
        sets = ", ".join([f"{k}=?" for k in data.keys()])
        values = list(data.values())

        # update_date 자동 갱신
        sets += ", update_date=datetime('now')"
        values.append(project_id)

        sql = f"UPDATE projects SET {sets} WHERE id=?"
        print("[DEBUG] project full update:", sql, values)

        cur.execute(sql, values)
        db.commit()

        if cur.rowcount == 0:
            return jsonify({"error": f"Project {project_id} not found"}), 404

        # 갱신된 행 반환
        row = db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone()
        return jsonify(dict(row)), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    
# ------------------ 대시보드 전용 API ------------------

@projects_bp.route('/api/assemblies/low_stock', methods=['GET'])
def get_low_stock_assemblies():
    """
    '재고 부족 pcb' 카드용.
    아이디어: 어셈블리별 필요 총량 대비 현재 재고(또는 할당) 수준으로 부족도를 계산.
    - allocation_percent: (할당량 / 필요총량)*100 으로 가정.
      필요총량 = SUM(ap.quantity_per * a.quantity_to_build)
      할당량   = SUM(ap.allocated_quantity)
    """
    try:
        db = get_db()
        rows = db.execute("""
            SELECT 
              a.id,
              a.assembly_name,
              a.quantity_to_build,
              a.status,
              -- 필요 총량
              SUM(ap.quantity_per * a.quantity_to_build) AS total_required,
              -- 현재 할당량(없으면 0)
              COALESCE(SUM(ap.allocated_quantity), 0)    AS allocated_quantity,
              -- % 계산(0으로 나눔 방지)
              CASE 
                WHEN SUM(ap.quantity_per * a.quantity_to_build) > 0 
                THEN 100.0 * COALESCE(SUM(ap.allocated_quantity), 0) 
                          / SUM(ap.quantity_per * a.quantity_to_build)
                ELSE 0
              END AS allocation_percent
            FROM assemblies a
            JOIN assembly_parts ap ON a.id = ap.assembly_id
            GROUP BY a.id, a.assembly_name, a.quantity_to_build, a.status
            HAVING allocation_percent < 100.0
            ORDER BY allocation_percent ASC, a.id DESC
        """).fetchall()

        return jsonify([dict(r) for r in rows]), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch low stock assemblies'}), 500
    
@projects_bp.route('/api/part_orders/recent', methods=['GET'])
def get_recent_part_orders():
    try:
        db = get_db()
        rows = db.execute("""
            SELECT 
              po.id,
              po.part_id,
              p.part_name,
              po.quantity_ordered,
              po.order_date,
              NULL AS expected_date,
              ''   AS status
            FROM part_orders po
            JOIN parts p ON p.id = po.part_id
            -- order_date는 TEXT라서 ISO 형식(YYYY-MM-DD HH:MM:SS)이면 문자열 정렬로도 최신순 보장
            ORDER BY po.order_date DESC, po.id DESC
            LIMIT 50
        """).fetchall()
        return jsonify([dict(r) for r in rows]), 200
    except Exception:
        import traceback; traceback.print_exc()
        return jsonify({'error': 'Failed to fetch recent part orders'}), 500


