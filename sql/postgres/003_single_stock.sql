-- Preserve history while consolidating company quantities into one stock.
INSERT INTO warehouses(name) SELECT 'Stock entreprise' WHERE NOT EXISTS(SELECT 1 FROM warehouses);
INSERT INTO units(name) VALUES('Article') ON CONFLICT(name) DO NOTHING;
INSERT INTO categories(name) SELECT 'Non classé' WHERE NOT EXISTS(SELECT 1 FROM categories WHERE name='Non classé');
ALTER TABLE app_settings ADD COLUMN stock_warehouse_id INTEGER REFERENCES warehouses(id);
ALTER TABLE app_settings ADD COLUMN stock_unit_id INTEGER REFERENCES units(id);
UPDATE app_settings SET stock_warehouse_id=(SELECT MIN(id) FROM warehouses),stock_unit_id=(SELECT id FROM units WHERE name='Article');
INSERT INTO stock_balances(warehouse_id,product_id,quantity)
SELECT (SELECT stock_warehouse_id FROM app_settings WHERE id=1),product_id,SUM(quantity) FROM stock_balances GROUP BY product_id
ON CONFLICT(warehouse_id,product_id) DO UPDATE SET quantity=EXCLUDED.quantity;
DELETE FROM stock_balances WHERE warehouse_id<>(SELECT stock_warehouse_id FROM app_settings WHERE id=1);
UPDATE documents SET warehouse_id=(SELECT stock_warehouse_id FROM app_settings WHERE id=1),destination_id=NULL,partner_id=NULL WHERE status='draft' AND kind IN('IN','OUT');
UPDATE documents SET status='cancelled' WHERE status='draft' AND kind='TRANSFER';
CREATE SEQUENCE product_sku_seq;
SELECT setval('product_sku_seq',COALESCE((SELECT MAX(substring(sku FROM 5)::bigint) FROM products WHERE sku ~ '^ART-[0-9]{1,12}$'),0)+1,false);
CREATE TABLE stock_counts(
 id SERIAL PRIMARY KEY,product_id INTEGER NOT NULL REFERENCES products(id),
 expected NUMERIC(18,3) NOT NULL,counted NUMERIC(18,3) NOT NULL CHECK(counted>=0),
 difference NUMERIC(18,3) NOT NULL,document_id INTEGER REFERENCES documents(id),
 user_id INTEGER NOT NULL REFERENCES users(id),request_key VARCHAR(100) UNIQUE NOT NULL,
 request_hash CHAR(64) NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
