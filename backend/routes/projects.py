from flask import Blueprint, request, jsonify, g
import sqlite3
import os
import traceback

projects_bp = Blueprint('projects', __name__)
DB_PATH = os.path.join(os.getcwd(), 'inventory.db')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db

@projects_bp.route('/projects', methods=['GET'])
def get_projects():
    try:
        db = get_db()
        projects = db.execute('SELECT * FROM projects').fetchall()
        result = [dict(row) for row in projects]
        return jsonify(result), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch projects'}), 500
    
@projects_bp.route('/projects/<int:project_id>', methods=['GET'])
def get_project_detail(project_id):
    try:
        db = get_db()
        project = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        return jsonify(dict(project)), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch project details'}), 500

@projects_bp.route('/projects', methods=['POST'])
def create_project():
    try:
        data = request.get_json()
        name = data.get('project_name', '').strip()
        description = data.get('description', '')
        status = data.get('status', 'Planned')
        end_date = data.get('end_date', None)

        if not name:
            return jsonify({'error': '프로젝트 이름은 필수입니다.'}), 400

        db = get_db()
        db.execute(
            'INSERT INTO projects (project_name, description, status, end_date) VALUES (?, ?, ?, ?)',
            (name, description, status, end_date)
        )
        db.commit()
        return jsonify({'message': 'Project created successfully'}), 201

    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Failed to create project'}), 500
    
@projects_bp.route('/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    try:
        db = get_db()
        cur = db.cursor()

        # 삭제 전 확인
        project = cur.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not project:
            return jsonify({'error': '해당 프로젝트가 존재하지 않습니다'}), 404

        # 삭제 수행
        cur.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        db.commit()

        return jsonify({'message': f'프로젝트 {project_id} 삭제 완료'}), 200

    except Exception:
        traceback.print_exc()
        return jsonify({'error': '프로젝트 삭제 중 오류 발생'}), 500


@projects_bp.route('/projects/<int:project_id>/assemblies/create', methods=['POST'])
def create_assembly_and_add_to_project(project_id):
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'JSON 데이터가 필요합니다'}), 400

        name = data.get("assembly_name", "").strip()
        username = data.get("username", "Unknown")

        if not name:
            return jsonify({"error": "어셈블리 이름이 필요합니다"}), 400

        db = get_db()
        cur = db.cursor()

        # 1. 어셈블리 중복 확인
        cur.execute("SELECT id FROM assemblies WHERE assembly_name = ?", (name,))
        if cur.fetchone():
            return jsonify({"error": "이미 존재하는 어셈블리 이름입니다"}), 400

        # 2. 어셈블리 생성
        cur.execute("""
            INSERT INTO assemblies (assembly_name, last_modified_user, create_date, update_date)
            VALUES (?, ?, datetime('now'), datetime('now'))
        """, (name, username))
        assembly_id = cur.lastrowid

        # 3. 프로젝트에 연결
        cur.execute("""
            INSERT OR IGNORE INTO project_assemblies (project_id, assembly_id)
            VALUES (?, ?)
        """, (project_id, assembly_id))

        db.commit()

        return jsonify({
            "message": f"{name} 어셈블리 생성 및 프로젝트 연결 완료",
            "assembly_id": assembly_id,
            "project_id": project_id
        }), 201

    except Exception:
        traceback.print_exc()
        return jsonify({'error': '어셈블리 생성 또는 프로젝트 연결 실패'}), 500

@projects_bp.route('/projects/<int:project_id>/summary', methods=['GET'])
def get_project_summary(project_id):
    try:
        db = get_db()

        # 1. 어셈블리 목록
        assemblies = db.execute('''
            SELECT a.id, a.assembly_name, a.quantity_to_build, a.status
            FROM assemblies a
            JOIN project_assemblies pa ON a.id = pa.assembly_id
            WHERE pa.project_id = ?
        ''', (project_id,)).fetchall()

        # 2. 부품 발주 내역 (중복 방지를 위해 DISTINCT 추가 가능)
        orders = db.execute('''
            SELECT po.*, p.part_name
            FROM part_orders po
            JOIN parts p ON po.part_id = p.id
            JOIN assembly_parts ap ON po.part_id = ap.part_id
            JOIN project_assemblies pa ON ap.assembly_id = pa.assembly_id
            WHERE pa.project_id = ?
        ''', (project_id,)).fetchall()

        # 3. 자재 현황 (필요 수량, 현재 재고, 할당량 포함)
        materials = db.execute('''
            SELECT 
              p.id AS part_id,
              p.part_name,
              SUM(ap.quantity_per * a.quantity_to_build) AS total_required,
              p.quantity AS current_stock,
              SUM(ap.allocated_quantity) AS allocated_quantity
            FROM parts p
            JOIN assembly_parts ap ON p.id = ap.part_id
            JOIN assemblies a ON ap.assembly_id = a.id
            JOIN project_assemblies pa ON a.id = pa.assembly_id
            WHERE pa.project_id = ?
            GROUP BY p.id, p.part_name, p.quantity
        ''', (project_id,)).fetchall()

        return jsonify({
            'assemblies': [dict(a) for a in assemblies],
            'orders': [dict(o) for o in orders],
            'materials': [dict(m) for m in materials],
        }), 200

    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch project summary'}), 500
    
@projects_bp.route('/projects/<int:project_id>/parts', methods=['GET'])
def get_all_project_parts(project_id):
    try:
        db = get_db()
        parts = db.execute('''
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
            JOIN assemblies a ON pa.assembly_id = a.id
            JOIN assembly_parts ap ON a.id = ap.assembly_id
            JOIN parts p ON ap.part_id = p.id
            WHERE pa.project_id = ?
        ''', (project_id,)).fetchall()

        return jsonify([dict(row) for row in parts]), 200

    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch parts for project'}), 500

@projects_bp.route('/assemblies/<int:assembly_id>/update', methods=['PUT'])
def update_assembly_quantity(assembly_id):
    try:
        data = request.get_json()
        new_quantity = data.get('quantity_to_build')

        if not isinstance(new_quantity, int) or new_quantity <= 0:
            return jsonify({'error': '유효한 수량이 필요합니다'}), 400

        db = get_db()
        db.execute(
            "UPDATE assemblies SET quantity_to_build = ?, update_date = datetime('now') WHERE id = ?",
            (new_quantity, assembly_id)
        )
        db.commit()

        return jsonify({'message': '수량이 성공적으로 업데이트되었습니다'}), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': '수량 업데이트 실패'}), 500
    
@projects_bp.route('/api/projects/<int:project_id>/assemblies/<int:assembly_id>', methods=['DELETE'])
def remove_assembly_from_project(project_id, assembly_id):
    try:
        db = get_db()
        cur = db.cursor()

        cur.execute('''
            DELETE FROM project_assemblies
            WHERE project_id = ? AND assembly_id = ?
        ''', (project_id, assembly_id))
        db.commit()

        return jsonify({'message': '연결 제거 완료'}), 200

    except Exception:
        traceback.print_exc()
        return jsonify({'error': '연결 제거 중 오류 발생'}), 500