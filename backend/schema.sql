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
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE part_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_id INTEGER NOT NULL,
  order_date TEXT NOT NULL,
  quantity_ordered INTEGER NOT NULL,
  assembly_id INTEGER,
  project_id INTEGER,
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
  version TEXT,
  manufacturing_method TEXT,
  work_date DATE,
  work_duration INTEGER,
  is_soldered BOOLEAN,
  is_tested BOOLEAN
);

CREATE TABLE assembly_parts (
    assembly_id INTEGER,
    part_id INTEGER,
    quantity_per INTEGER,
    reference TEXT,
    update_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    allocated_quantity INTEGER DEFAULT 0,
    PRIMARY KEY (assembly_id, part_id),
    FOREIGN KEY (assembly_id) REFERENCES assemblies(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES parts(id)
);

CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL UNIQUE,
  description TEXT,
  create_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project_assemblies (
  project_id INTEGER NOT NULL,
  assembly_id INTEGER NOT NULL,
  PRIMARY KEY (project_id, assembly_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (assembly_id) REFERENCES assemblies(id) ON DELETE CASCADE
);

CREATE TABLE aliases (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  alias_name TEXT NOT NULL UNIQUE COLLATE BINARY
);

CREATE TABLE alias_links (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  alias_id   INTEGER NOT NULL,
  part_id    INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alias_id) REFERENCES aliases(id) ON DELETE CASCADE,
  FOREIGN KEY (part_id)  REFERENCES parts(id)  ON DELETE CASCADE,
  UNIQUE(alias_id, part_id)
);
