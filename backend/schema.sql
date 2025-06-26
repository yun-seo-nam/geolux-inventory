CREATE TABLE parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_name TEXT NOT NULL UNIQUE,
  quantity INTEGER DEFAULT 0,
  ordered_quantity INTEGER DEFAULT 0,
  price REAL,
  value TEXT,
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
  FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
);

CREATE TABLE assemblies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assembly_name TEXT NOT NULL UNIQUE,
  quantity_to_build INTEGER DEFAULT 0,
  description TEXT,
  status TEXT CHECK(status IN ('Planned', 'In Progress', 'Completed')) DEFAULT 'Planned',
  image_filename TEXT,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_modified_user TEXT
);

CREATE TABLE assembly_parts (
    assembly_id INTEGER,
    part_id INTEGER,
    quantity_per INTEGER,
    reference TEXT,
    update_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (assembly_id, part_id),
    FOREIGN KEY (assembly_id) REFERENCES assemblies(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES parts(id)
);

