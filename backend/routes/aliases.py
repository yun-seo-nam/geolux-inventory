# backend/routes/aliases.py
from flask import Blueprint, request, jsonify, g
import sqlite3
import os

# CORS (블루프린트 레벨)
from flask_cors import CORS

aliases_bp = Blueprint('aliases', __name__)

# 프론트엔드 주소 허용
CORS(aliases_bp, resources={r"/api/*": {
    "origins": ["http://192.168.0.2:3000", "http://localhost:3000"]
}})

DB_PATH = os.path.join(os.getcwd(), 'inventory.db')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        # [중요] 외래키 제약조건 활성화 (그룹 삭제 시 링크도 자동 삭제되도록)
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db

# ==========================================
# 1. 특정 부품의 Alias 여부 확인
# ==========================================
@aliases_bp.route("/api/parts/<int:part_id>/alias", methods=["GET"])
def get_part_alias(part_id):
    try:
        db = get_db()
        row = db.execute("""
            SELECT a.id, a.alias_name 
            FROM aliases a
            JOIN alias_links al ON al.alias_id = a.id
            WHERE al.part_id = ?
        """, (part_id,)).fetchone()
        
        if row:
            return jsonify(dict(row))
        return jsonify(None)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==========================================
# 2. 호환 그룹 생성
# ==========================================
@aliases_bp.route("/api/aliases", methods=["POST"])
def create_alias():
    data = request.get_json(silent=True) or {}
    alias_name = (data.get("alias_name") or "").strip().upper()
    
    if not alias_name:
        return jsonify({"error": "그룹 이름이 필요합니다."}), 400

    try:
        db = get_db()
        cur = db.cursor()
        cur.execute("INSERT INTO aliases(alias_name) VALUES (?)", (alias_name,))
        db.commit()
        return jsonify({"id": cur.lastrowid, "alias_name": alias_name}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "이미 존재하는 그룹 이름입니다."}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==========================================
# 3. 그룹 이름 검색
# ==========================================
@aliases_bp.route("/api/aliases/search", methods=["GET"])
def search_alias():
    q = request.args.get("q", "").strip()
    limit = request.args.get("limit", 10)
    
    try:
        db = get_db()
        rows = db.execute(
            "SELECT * FROM aliases WHERE alias_name LIKE ? LIMIT ?", 
            (f"%{q}%", limit)
        ).fetchall()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==========================================
# 4. 그룹 내 부품 목록 조회
# ==========================================
@aliases_bp.route("/api/aliases/<int:alias_id>/links", methods=["GET"])
def get_alias_links(alias_id):
    try:
        db = get_db()
        rows = db.execute("""
            SELECT al.id as link_id, al.part_id, p.part_name, p.quantity, al.alias_id
            FROM alias_links al
            JOIN parts p ON p.id = al.part_id
            WHERE al.alias_id = ?
        """, (alias_id,)).fetchall()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==========================================
# 5. 그룹에 부품 추가 (Link)
# ==========================================
@aliases_bp.route("/api/aliases/<int:alias_id>/links", methods=["POST"])
def add_alias_link(alias_id):
    data = request.get_json(silent=True) or {}
    part_id = data.get("part_id")
    
    if not part_id:
        return jsonify({"error": "part_id가 필요합니다."}), 400

    try:
        db = get_db()
        existing = db.execute("SELECT alias_id FROM alias_links WHERE part_id=?", (part_id,)).fetchone()
        
        if existing:
            if existing['alias_id'] == alias_id:
                 return jsonify({"message": "이미 이 그룹에 속해있습니다."}), 200
            else:
                 return jsonify({"error": "이 부품은 이미 다른 호환 그룹에 속해있습니다."}), 400

        db.execute("INSERT INTO alias_links(alias_id, part_id) VALUES (?, ?)", (alias_id, part_id))
        db.commit()
        return jsonify({"message": "연결 성공"}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==========================================
# 6. 링크 삭제 (Link ID로 삭제 - 우측 상세화면용)
# ==========================================
@aliases_bp.route("/api/aliases/links/<int:link_id>", methods=["DELETE"])
def delete_link(link_id):
    try:
        db = get_db()
        db.execute("DELETE FROM alias_links WHERE id = ?", (link_id,))
        db.commit()
        return jsonify({"message": "링크 삭제 완료"})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==========================================
# [추가] 7. 그룹 삭제 (Alias 자체 삭제)
# ==========================================
@aliases_bp.route("/api/aliases/<int:alias_id>", methods=["DELETE"])
def delete_alias(alias_id):
    try:
        db = get_db()
        # ON DELETE CASCADE 덕분에 링크들도 자동 삭제됨
        db.execute("DELETE FROM aliases WHERE id = ?", (alias_id,))
        db.commit()
        return jsonify({"message": "그룹 삭제 완료"})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@aliases_bp.route("/api/aliases/links/part/<int:part_id>", methods=["DELETE"])
def delete_link_by_part(part_id):
    try:
        db = get_db()
        
        # [핵심] 
        # alias_links 테이블에서 '이 부품(part_id)'에 해당하는 줄만 딱 삭제합니다.
        # aliases 테이블(그룹 이름)이나 parts 테이블(부품 정보)은 건드리지 않습니다.
        db.execute("DELETE FROM alias_links WHERE part_id = ?", (part_id,))
        
        db.commit()
        return jsonify({"message": "그룹에서 제외되었습니다."})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==========================================
# [추가] 8. 그룹 이름 수정 (Rename)
# ==========================================
@aliases_bp.route("/api/aliases/<int:alias_id>", methods=["PUT"])
def update_alias(alias_id):
    data = request.get_json(silent=True) or {}
    new_name = (data.get("alias_name") or "").strip().upper()
    
    if not new_name:
        return jsonify({"error": "이름이 필요합니다."}), 400
        
    try:
        db = get_db()
        db.execute("UPDATE aliases SET alias_name = ? WHERE id = ?", (new_name, alias_id))
        db.commit()
        return jsonify({"message": "수정 완료"})
    except sqlite3.IntegrityError:
        return jsonify({"error": "이미 존재하는 이름입니다."}), 409
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==========================================
# 9. 부품 병합 (Merge)
# ==========================================
@aliases_bp.route("/api/parts/merge", methods=["POST"])
def merge_parts():
    data = request.get_json(silent=True) or {}
    src_id = data.get("source_part_id")
    tgt_id = data.get("target_part_id")

    if not src_id or not tgt_id:
        return jsonify({"error": "두 부품의 ID가 필요합니다."}), 400

    try:
        db = get_db()
        src_link = db.execute("SELECT alias_id FROM alias_links WHERE part_id=?", (src_id,)).fetchone()
        tgt_link = db.execute("SELECT alias_id FROM alias_links WHERE part_id=?", (tgt_id,)).fetchone()
        
        src_aid = src_link["alias_id"] if src_link else None
        tgt_aid = tgt_link["alias_id"] if tgt_link else None

        if not src_aid and not tgt_aid:
            tgt_part = db.execute("SELECT part_name FROM parts WHERE id=?", (tgt_id,)).fetchone()
            if not tgt_part: return jsonify({"error": "Target 부품 없음"}), 404
            
            cur = db.execute("INSERT INTO aliases(alias_name) VALUES (?)", (tgt_part["part_name"].upper(),))
            new_aid = cur.lastrowid
            db.execute("INSERT INTO alias_links(alias_id, part_id) VALUES (?, ?)", (new_aid, src_id))
            db.execute("INSERT INTO alias_links(alias_id, part_id) VALUES (?, ?)", (new_aid, tgt_id))

        elif src_aid and not tgt_aid:
            db.execute("INSERT INTO alias_links(alias_id, part_id) VALUES (?, ?)", (src_aid, tgt_id))

        elif not src_aid and tgt_aid:
            db.execute("INSERT INTO alias_links(alias_id, part_id) VALUES (?, ?)", (tgt_aid, src_id))

        elif src_aid and tgt_aid and src_aid != tgt_aid:
            db.execute("UPDATE alias_links SET alias_id = ? WHERE alias_id = ?", (tgt_aid, src_aid))
            db.execute("DELETE FROM aliases WHERE id = ?", (src_aid,))

        db.commit()
        return jsonify({"message": "병합 완료"})

    except Exception as e:
        return jsonify({'error': str(e)}), 500