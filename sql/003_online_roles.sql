ALTER TABLE documents ADD COLUMN external_reference VARCHAR(100) NULL, ADD COLUMN request_key VARCHAR(100) UNIQUE NULL, ADD COLUMN request_hash CHAR(64) NULL;
UPDATE roles SET name='Responsable' WHERE code='manager';
-- Retain legacy historical links, but never promote an old reader to writer.
UPDATE users SET active=FALSE WHERE role='reader';
DELETE s FROM sessions s JOIN users u ON u.id=s.user_id WHERE u.active=FALSE;
CREATE TABLE app_settings (id TINYINT PRIMARY KEY,currency CHAR(3) NOT NULL DEFAULT 'EUR',organisation VARCHAR(100) NOT NULL DEFAULT 'StockMaster',timezone VARCHAR(80) NOT NULL DEFAULT 'Africa/Johannesburg') ENGINE=InnoDB;
INSERT INTO app_settings(id) VALUES(1);
