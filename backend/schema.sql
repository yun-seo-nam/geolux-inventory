-- 1. parts 테이블
CREATE TABLE parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_name TEXT NOT NULL UNIQUE,
  quantity INTEGER DEFAULT 0,
  ordered_quantity INTEGER DEFAULT 0,
  price REAL,
  supplier TEXT,
  purchase_date TEXT,
  purchase_url TEXT,
  manufacturer TEXT,
  description TEXT,
  mounting_type TEXT,
  package TEXT,
  location TEXT,
  memo TEXT,
  category_large TEXT,
  category_medium TEXT,
  category_small TEXT,
  image_filename TEXT,
  last_modified_user TEXT,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE part_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_id INTEGER NOT NULL,
  order_date TEXT NOT NULL,
  quantity_ordered INTEGER NOT NULL,
  fulfilled INTEGER DEFAULT 0,      -- 0: 미완료, 1: 완료
  FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
);

-- 2. assemblies 테이블
CREATE TABLE assemblies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assembly_name TEXT NOT NULL,
  last_modified_user TEXT,
  quantity_to_build INTEGER DEFAULT 0,
  status TEXT CHECK(status IN ('Planned', 'In Progress', 'Completed')) DEFAULT 'Planned',
  image_filename TEXT,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. assembly_parts 테이블
CREATE TABLE assembly_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assembly_id INTEGER NOT NULL,
  part_id INTEGER NOT NULL,
  quantity_per INTEGER NOT NULL,
  reference TEXT,
  FOREIGN KEY (assembly_id) REFERENCES assemblies(id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
);
