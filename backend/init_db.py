import sqlite3

def init_db():
    with sqlite3.connect("inventory.db") as conn:
        with open("schema.sql", encoding="utf-8") as f:
            conn.executescript(f.read())
    print("DB 생성 완료: inventory.db")

if __name__ == "__main__":
    init_db()
