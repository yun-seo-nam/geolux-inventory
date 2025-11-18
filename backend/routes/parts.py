from flask import Blueprint, request, jsonify
from datetime import datetime
import sqlite3
import os
import glob
from werkzeug.utils import secure_filename

parts_bp = Blueprint("parts", __name__)
order_bp = Blueprint("orders", __name__)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "inventory.db")

# 이미지 저장 폴더: 프로젝트 루트/static/images/parts
IMAGE_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "static", "images", "parts"
)
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg"}
os.makedirs(IMAGE_DIR, exist_ok=True)


def allowed_file(filename):
    """
    업로드된 파일 확장자가 허용 목록에 있는지 검사
    """
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@parts_bp.route("/api/parts", methods=["POST"])
def add_part():
    data = request.get_json()
    print("Received data:", data)

    if not data.get("part_name"):
        return jsonify({"error": "part_name은 필수입니다."}), 400

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO parts (
                part_name, quantity, price, supplier, purchase_date,
                location, description, manufacturer, mounting_type, package,
                purchase_url, memo,
                category_large, category_medium, category_small,
                create_date, update_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data.get("part_name"),
                data.get("quantity") or 0,
                data.get("price") or 0,
                data.get("supplier"),
                data.get("purchase_date"),
                data.get("location"),
                data.get("description"),
                data.get("manufacturer"),
                data.get("mounting_type"),
                data.get("package"),
                data.get("purchase_url"),
                data.get("memo"),
                data.get("category_large") or "미정",
                data.get("category_medium") or "미정",
                data.get("category_small") or "미정",
                datetime.now(),
                datetime.now(),
            ),
        )

        conn.commit()
        conn.close()
        return jsonify({"message": "부품이 성공적으로 추가되었습니다."}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "이미 존재하는 부품 이름입니다."}), 409
    except Exception as e:
        print("Error in add_part:", e)
        return jsonify({"error": str(e)}), 500


@parts_bp.route("/api/parts", methods=["GET"])
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
            if part_dict.get("image_filename"):
                part_dict["image_url"] = (
                    f"/static/images/parts/{part_dict['image_filename']}"
                )
            else:
                part_dict["image_url"] = None

            parts.append(part_dict)

        conn.close()
        return jsonify(parts)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@parts_bp.route("/api/categories/large", methods=["GET"])
def get_large_categories():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT DISTINCT category_large FROM parts WHERE category_large IS NOT NULL"
        )
        rows = cursor.fetchall()

        categories = [row[0] for row in rows if row[0]]
        return jsonify(categories)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@parts_bp.route("/api/categories/medium", methods=["GET"])
def get_medium_categories():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT DISTINCT category_medium FROM parts WHERE category_medium IS NOT NULL"
        )
        rows = cursor.fetchall()

        categories = [row[0] for row in rows if row[0]]
        return jsonify(categories)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@parts_bp.route("/api/categories/small", methods=["GET"])
def get_small_categories():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT DISTINCT category_small FROM parts WHERE category_small IS NOT NULL"
        )
        rows = cursor.fetchall()

        categories = [row[0] for row in rows if row[0]]
        return jsonify(categories)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@parts_bp.route("/api/parts", methods=["DELETE"])
def delete_parts():
    data = request.get_json()
    ids = data.get("ids", [])

    if not ids:
        return jsonify({"error": "삭제할 ID가 없습니다."}), 400

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # 삭제 불가 조건 체크 (재고 > 0 인 부품 확인)
        cursor.execute(
            "SELECT id, quantity FROM parts WHERE id IN ({seq}) AND quantity > 0".format(
                seq=",".join(["?"] * len(ids))
            ),
            ids
        )
        not_deletable = cursor.fetchall()

        if not_deletable:
            return jsonify({
                "error": "재고가 남아있는 부품은 삭제할 수 없습니다.",
                "details": [{"id": row[0], "quantity": row[1]} for row in not_deletable]
            }), 400

        # 이미지 파일 삭제
        for part_id in ids:
            pattern = os.path.join(IMAGE_DIR, f"part_{part_id}.*")
            for file in glob.glob(pattern):
                os.remove(file)

        # DB 삭제
        cursor.executemany("DELETE FROM parts WHERE id = ?", [(i,) for i in ids])
        conn.commit()
        conn.close()

        return jsonify({"message": f"{len(ids)}개 부품 삭제됨"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@parts_bp.route("/api/parts/<int:part_id>", methods=["GET"])
def get_part_detail(part_id):
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM parts WHERE id = ?", (part_id,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return jsonify({"error": "해당 부품을 찾을 수 없습니다."}), 404

        part_dict = dict(row)

        # 이미지 URL 생성 (image_filename이 있을 때만)
        if part_dict.get("image_filename"):
            part_dict["image_url"] = (
                f"/static/images/parts/{part_dict['image_filename']}"
            )
        else:
            part_dict["image_url"] = None

        return jsonify(part_dict)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------
# 8. 부품 정보 수정 (텍스트 필드만)
# -------------------------------------------------------
@parts_bp.route("/api/parts/<int:part_id>", methods=["PUT"])
def update_part(part_id):
    data = request.get_json()

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute(
            """
            UPDATE parts SET
                part_name = ?,
                category_large = ?,
                category_medium = ?,
                category_small = ?,
                quantity = ?,
                ordered_quantity = ?,
                price = ?,
                manufacturer = ?,
                package = ?,
                mounting_type = ?,
                location = ?,
                memo = ?,
                description = ?,
                update_date = ?,
                purchase_url = ?,
                supplier = ?
            WHERE id = ?
        """,
            (
                data.get("part_name"),
                data.get("category_large"),
                data.get("category_medium"),
                data.get("category_small"),
                data.get("quantity") or 0,
                data.get("ordered_quantity") or 0,
                data.get("price") or 0,
                data.get("manufacturer"),
                data.get("package"),
                data.get("mounting_type"),
                data.get("location"),
                data.get("memo"),
                data.get("description"),
                datetime.now(),
                data.get("purchase_url"),
                data.get("supplier"),
                part_id,
            ),
        )

        conn.commit()
        conn.close()

        return jsonify({"message": "부품 정보가 수정되었습니다."}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@parts_bp.route("/api/parts/<int:part_id>/upload-image", methods=["POST"])
def upload_part_image(part_id):
    """
    클라이언트에서 multipart/form-data로 'image' 필드를 보내면,
    part_{id}.확장자 형태로 저장하고 DB에 image_filename 컬럼으로 기록
    """
    if "image" not in request.files:
        return jsonify({"error": "업로드할 이미지 파일이 없습니다."}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "파일명이 비어 있습니다."}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "허용되지 않는 파일 확장자입니다."}), 400

    # 확장자 추출
    ext = file.filename.rsplit(".", 1)[1].lower()
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
        cursor.execute(
            "UPDATE parts SET image_filename = ? WHERE id = ?", (filename, part_id)
        )
        conn.commit()
        conn.close()

        image_url = f"/static/images/parts/{filename}"
        return jsonify({"image_url": image_url}), 200

    except Exception as e:
        return jsonify({"error": f"이미지 저장 또는 DB 업데이트 실패: {str(e)}"}), 500


@order_bp.route("/api/parts/<int:part_id>/orders", methods=["GET"])
def get_orders_by_part(part_id):
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        cur.execute(
            """
            SELECT id, part_id, order_date, quantity_ordered
            FROM part_orders
            WHERE part_id = ?
            ORDER BY order_date DESC
        """,
            (part_id,),
        )

        rows = cur.fetchall()
        orders = [dict(row) for row in rows]

        return jsonify(orders), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@order_bp.route("/api/part_orders", methods=["POST"])
def create_or_merge_order():
    data = request.get_json()
    print("[POST] /api/part_orders - 받은 데이터:", data)
    part_id = data["part_id"]
    order_date = data["order_date"]
    qty = data["quantity_ordered"]

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT id, quantity_ordered FROM part_orders
        WHERE part_id = ? AND order_date = ?
    """,
        (part_id, order_date),
    )
    existing = cur.fetchone()

    if existing:
        new_qty = existing["quantity_ordered"] + qty
        cur.execute(
            "UPDATE part_orders SET quantity_ordered = ? WHERE id = ?",
            (new_qty, existing["id"]),
        )
    else:
        cur.execute(
            """
            INSERT INTO part_orders (part_id, order_date, quantity_ordered)
            VALUES (?, ?, ?)
        """,
            (part_id, order_date, qty),
        )

    conn.commit()
    return jsonify({"success": True})


@order_bp.route("/api/part_orders/<int:order_id>/fulfill", methods=["PATCH"])
def fulfill_part_order(order_id):
    try:
        conn = get_db()
        cur = conn.cursor()

        # 주문 수량 및 부품 ID 조회
        cur.execute(
            """
            SELECT part_id, quantity_ordered
            FROM part_orders
            WHERE id = ?
        """,
            (order_id,),
        )
        row = cur.fetchone()

        if not row:
            return jsonify({"error": "해당 주문을 찾을 수 없습니다."}), 404

        part_id = row["part_id"]
        qty = row["quantity_ordered"]

        # 부품 재고 증가
        cur.execute(
            """
            UPDATE parts
            SET quantity = quantity + ?
            WHERE id = ?
        """,
            (qty, part_id),
        )

        cur.execute("DELETE FROM part_orders WHERE id = ?", (order_id,))

        conn.commit()
        return jsonify({"message": "배송 완료 처리 및 재고 반영 완료"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@parts_bp.route(
    "/api/assemblies/<int:assembly_id>/bom/<int:part_id>/allocate", methods=["PUT"]
)
def allocate_part(assembly_id, part_id):
    data = request.get_json()
    amount = data.get("amount")

    if not isinstance(amount, int) or amount <= 0:
        return jsonify({"error": "양수인 할당 수량을 입력해야 합니다."}), 400

    conn = get_db()
    cur = conn.cursor()

    # 부품 수량, 현재 할당량, 필요 수량 확인
    cur.execute(
        """
        SELECT p.quantity, ap.allocated_quantity, ap.quantity_per, a.quantity_to_build
        FROM parts p
        JOIN assembly_parts ap ON p.id = ap.part_id
        JOIN assemblies a ON ap.assembly_id = a.id
        WHERE ap.assembly_id = ? AND ap.part_id = ?
    """,
        (assembly_id, part_id),
    )
    row = cur.fetchone()

    if not row:
        return jsonify({"error": "해당 부품이 어셈블리에 존재하지 않습니다."}), 404

    part_qty = row["quantity"]
    allocated = row["allocated_quantity"] or 0
    quantity_per = row["quantity_per"]
    to_build = row["quantity_to_build"]
    required_total = quantity_per * to_build

    if amount > part_qty:
        return jsonify({"error": "재고보다 많은 양을 할당할 수 없습니다."}), 400
    if allocated + amount > required_total:
        return jsonify({"error": "필요 수량보다 많은 할당은 불가능합니다."}), 400

    # 할당 처리
    cur.execute(
        """
        UPDATE assembly_parts
        SET allocated_quantity = allocated_quantity + ?
        WHERE assembly_id = ? AND part_id = ?
    """,
        (amount, assembly_id, part_id),
    )

    cur.execute(
        """
        UPDATE parts
        SET quantity = quantity - ?
        WHERE id = ?
    """,
        (amount, part_id),
    )
    recalculate_assembly_status(conn, assembly_id)
    conn.commit()
    return jsonify({"success": True}), 200


@parts_bp.route(
    "/api/assemblies/<int:assembly_id>/bom/<int:part_id>/deallocate", methods=["PUT"]
)
def deallocate_part(assembly_id, part_id):
    data = request.get_json()
    amount = data.get("amount")

    if not isinstance(amount, int) or amount <= 0:
        return jsonify({"error": "양수인 취소 수량을 입력해야 합니다."}), 400

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT allocated_quantity
        FROM assembly_parts
        WHERE assembly_id = ? AND part_id = ?
    """,
        (assembly_id, part_id),
    )
    row = cur.fetchone()

    if not row:
        return jsonify({"error": "해당 부품이 어셈블리에 존재하지 않습니다."}), 404

    allocated = row["allocated_quantity"] or 0

    if amount > allocated:
        return jsonify({"error": "할당된 수량보다 많이 취소할 수 없습니다."}), 400

    # 할당 취소 처리
    cur.execute(
        """
        UPDATE assembly_parts
        SET allocated_quantity = allocated_quantity - ?
        WHERE assembly_id = ? AND part_id = ?
    """,
        (amount, assembly_id, part_id),
    )

    cur.execute(
        """
        UPDATE parts
        SET quantity = quantity + ?
        WHERE id = ?
    """,
        (amount, part_id),
    )
    recalculate_assembly_status(conn, assembly_id)
    conn.commit()
    return jsonify({"success": True}), 200


def recalculate_assembly_status(conn, assembly_id):
    row = conn.execute(
        """
        SELECT a.quantity_to_build, 
               SUM(ap.quantity_per) as total_needed, 
               SUM(ap.allocated_quantity) as total_allocated
        FROM assemblies a
        JOIN assembly_parts ap ON a.id = ap.assembly_id
        WHERE a.id = ?
        GROUP BY a.id
    """,
        (assembly_id,),
    ).fetchone()

    if not row:
        return

    total_required = row["quantity_to_build"] * row["total_needed"]
    allocated = row["total_allocated"] or 0
    percent = 0 if total_required == 0 else (allocated / total_required)

    if percent == 1:
        status = "Completed"
    elif percent > 0:
        status = "In Progress"
    else:
        status = "Planned"

    conn.execute("UPDATE assemblies SET status = ? WHERE id = ?", (status, assembly_id))
    conn.commit()

@parts_bp.route("/api/part_orders/recent", methods=["GET"])
def get_recent_part_orders():
    try:
        db = get_db()
        rows = db.execute(
            """
            SELECT po.id, po.order_date, po.quantity_ordered,
                   p.part_name, p.id AS part_id
            FROM part_orders po
            JOIN parts p ON po.part_id = p.id
            ORDER BY po.order_date DESC
            LIMIT 10
        """
        ).fetchall()
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        current_app.logger.error(f"Error fetching part orders: {e}")
        return jsonify({"error": str(e)}), 500
    
@parts_bp.route('/api/parts/full/<int:part_id>', methods=['PUT'])
def update_part_full(part_id):
    data = request.get_json() or {}
    if not data:
        return jsonify({"error": "Empty body"}), 400
    try:
        # (선택) 화이트리스트 & 간단한 타입 보정
        allowed = [
            "part_name","quantity","ordered_quantity","price",
            "supplier","purchase_date","purchase_url","manufacturer",
            "description","mounting_type","package","location","memo",
            "category_large","category_medium","category_small","image_filename"
        ]
        data = {k: data[k] for k in data if k in allowed}
        for k in ("quantity","ordered_quantity"):
            if k in data:
                try: data[k] = int(data[k])
                except: pass
        if "price" in data and data["price"] not in (None, ""):
            try: data["price"] = float(data["price"])
            except: pass

        db = get_db()
        cur = db.cursor()
        sets = ", ".join([f"{k}=?" for k in data.keys()])
        values = list(data.values())
        sets += ", update_date=datetime('now')"
        values.append(part_id)

        print("[DEBUG][parts FULL] SQL:", f"UPDATE parts SET {sets} WHERE id=?")
        print("[DEBUG][parts FULL] VAL:", values)

        cur.execute(f"UPDATE parts SET {sets} WHERE id=?", values)
        db.commit()
        print("[DEBUG][parts FULL] rowcount:", cur.rowcount)

        row = db.execute("SELECT * FROM parts WHERE id=?", (part_id,)).fetchone()
        if not row:
            return jsonify({"error":"Part not found"}), 404

        return jsonify(dict(row)), 200
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    
# ===== alias APIs (리팩토링 버전, parts.py 내장 get_db 사용) =====
from contextlib import contextmanager

aliases_bp = Blueprint("aliases", __name__)

@contextmanager
def db_conn():
    """자동으로 close/commit 되는 DB context manager"""
    conn = get_db()  
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
    finally:
        conn.close()

def _norm_name(s: str) -> str:
    return (s or "").strip()

# ==============================
# 1) alias 검색 (페이징 + 매핑수 + 전체 개수)
# ==============================
@aliases_bp.route("/api/aliases/search", methods=["GET"])
def search_alias():
    q = _norm_name(request.args.get("q", ""))
    limit = int(request.args.get("limit", 100))
    offset = int(request.args.get("offset", 0))
    like = f"%{q}%" if q else "%"

    with db_conn() as conn:
        rows = conn.execute("""
            SELECT a.id, a.alias_name,
                   COUNT(al.id) AS mapped_count,
                   COUNT(*) OVER() AS total_count   
            FROM aliases a
            LEFT JOIN alias_links al ON al.alias_id = a.id
            WHERE UPPER(a.alias_name) LIKE ?
            GROUP BY a.id
            ORDER BY a.alias_name ASC
            LIMIT ? OFFSET ?
        """, (like, limit, offset)).fetchall()
    return jsonify([dict(r) for r in rows])

# ==============================
# 2) alias에 연결된 부품 조회
# ==============================
@aliases_bp.route("/api/aliases/<int:alias_id>/links", methods=["GET"])
def get_alias_links(alias_id):
    with db_conn() as conn:
        alias = conn.execute("SELECT id, alias_name FROM aliases WHERE id=?", (alias_id,)).fetchone()
        if not alias:
            return jsonify({"error": "Alias not found"}), 404

        rows = conn.execute("""
            SELECT al.id AS id, al.part_id, p.part_name, p.quantity
            FROM alias_links al
            JOIN parts p ON p.id = al.part_id
            WHERE al.alias_id = ?
            ORDER BY p.part_name ASC
        """, (alias_id,)).fetchall()
    return jsonify([dict(r) for r in rows])

# ==============================
# 3) alias 추가
# ==============================
@aliases_bp.route("/api/aliases", methods=["POST"])
def create_alias():
    data = request.get_json(silent=True) or {}
    alias_name = _norm_name(data.get("alias_name"))
    if not alias_name:
        return jsonify({"error": "alias_name은 필수입니다."}), 400

    with db_conn() as conn:
        try:
            cur = conn.execute("INSERT INTO aliases(alias_name) VALUES (?)", (alias_name,))
            conn.commit()
        except sqlite3.IntegrityError:
            return jsonify({"error": "이미 존재하는 alias_name입니다."}), 409

        new_id = cur.lastrowid
    return jsonify({"id": new_id, "alias_name": alias_name}), 201

# ==============================
# 4) alias link 추가 (최대 최적화된 버전)
# ==============================
@aliases_bp.route("/api/aliases/<int:alias_id>/links", methods=["POST"])
def create_alias_link(alias_id):
    data = request.get_json(silent=True) or {}
    part_id = data.get("part_id")
    if not part_id:
        return jsonify({"error": "part_id는 필수입니다."}), 400

    with db_conn() as conn:
        row = conn.execute("""
            SELECT 
                a.alias_name AS alias_name,
                p.part_name AS part_name,
                EXISTS(SELECT 1 FROM aliases WHERE alias_name = p.part_name) AS part_is_alias
            FROM aliases a
            JOIN parts p ON p.id = ?
            WHERE a.id = ?
        """, (part_id, alias_id)).fetchone()

        if not row:
            return jsonify({"error": "Alias 또는 Part가 존재하지 않습니다."}), 404

        if row["alias_name"] == row["part_name"]:
            return jsonify({"error": "자기 자신(alias)을 하위 링크로 추가할 수 없습니다."}), 400

        if row["part_is_alias"]:
            return jsonify({"error": "이미 별칭으로 등록된 부품은 링크로 추가할 수 없습니다."}), 400

        try:
            cur = conn.execute(
                "INSERT INTO alias_links(alias_id, part_id) VALUES (?, ?)",
                (alias_id, part_id)
            )
            conn.commit()
        except sqlite3.IntegrityError:
            return jsonify({"error": "이미 존재하는 연결입니다."}), 409

        result = conn.execute("""
            SELECT al.id, al.part_id, p.part_name, p.quantity
            FROM alias_links al
            JOIN parts p ON p.id = al.part_id
            WHERE al.id = ?
        """, (cur.lastrowid,)).fetchone()
    return jsonify(dict(result)), 201

# ==============================
# 5) alias 삭제 / link 삭제
# ==============================
def _exec_and_check(conn, query, params, not_found_msg):
    cur = conn.execute(query, params)
    conn.commit()
    if cur.rowcount == 0:
        return jsonify({"error": not_found_msg}), 404
    return None

@aliases_bp.route("/api/aliases/<int:alias_id>", methods=["DELETE"])
def delete_alias(alias_id):
    with db_conn() as conn:
        err = _exec_and_check(conn, "DELETE FROM aliases WHERE id=?", (alias_id,), "Alias not found")
        if err:
            return err
    return jsonify({"message": "alias 및 관련 링크 삭제 성공"})

@aliases_bp.route("/api/aliases/links/<int:link_id>", methods=["DELETE"])
def delete_alias_link(link_id):
    with db_conn() as conn:
        err = _exec_and_check(conn, "DELETE FROM alias_links WHERE id=?", (link_id,), "Link not found")
        if err:
            return err
    return jsonify({"message": "alias link 삭제 성공"})

# ==============================
# 6) alias 이름 수정
# ==============================
@aliases_bp.route("/api/aliases/<int:alias_id>", methods=["PUT"])
def update_alias(alias_id):
    data = request.get_json(silent=True) or {}
    alias_name = _norm_name(data.get("alias_name"))
    if not alias_name:
        return jsonify({"error": "alias_name은 필수입니다."}), 400

    with db_conn() as conn:
        try:
            cur = conn.execute("UPDATE aliases SET alias_name=? WHERE id=?", (alias_name, alias_id))
            conn.commit()
        except sqlite3.IntegrityError:
            return jsonify({"error": "alias_name 중복"}), 409

        if cur.rowcount == 0:
            return jsonify({"error": "Alias not found"}), 404

    return jsonify({"id": alias_id, "alias_name": alias_name, "message": "alias 수정 성공"})
