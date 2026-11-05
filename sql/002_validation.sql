-- Each CALL owns its transaction. Never invoke inside another transaction.
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS validate_document(IN p_id BIGINT UNSIGNED, IN p_actor BIGINT UNSIGNED, IN p_key VARCHAR(100))
proc: BEGIN
 DECLARE v_status VARCHAR(20); DECLARE v_kind VARCHAR(20); DECLARE v_source BIGINT UNSIGNED; DECLARE v_dest BIGINT UNSIGNED;
 DECLARE v_product BIGINT UNSIGNED; DECLARE v_qty DECIMAL(18,3); DECLARE v_stock DECIMAL(18,3); DECLARE v_done BOOLEAN DEFAULT FALSE;
 DECLARE v_year SMALLINT; DECLARE v_counter BIGINT; DECLARE v_prefix VARCHAR(10); DECLARE v_count INT; DECLARE v_saved_key VARCHAR(100);
 DECLARE movement_cursor CURSOR FOR SELECT product_id,quantity FROM document_lines WHERE document_id=p_id ORDER BY product_id;
 DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done=TRUE;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 START TRANSACTION;
 IF p_key IS NULL OR LENGTH(p_key)<8 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Document : clé idempotente requise'; END IF;
 SELECT COUNT(*) INTO v_count FROM users WHERE id=p_actor AND active=1 AND role IN ('admin','manager');
 IF v_count<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FORBIDDEN'; END IF;
 SELECT status,kind,warehouse_id,destination_id,idempotency_key INTO v_status,v_kind,v_source,v_dest,v_saved_key FROM documents WHERE id=p_id FOR UPDATE;
 IF v_done THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Document introuvable'; END IF;
 IF v_status='validated' AND v_saved_key=p_key THEN COMMIT; LEAVE proc; END IF;
 IF v_status<>'draft' OR v_kind NOT IN ('IN','OUT','TRANSFER') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Document non validable'; END IF;
 IF v_kind='TRANSFER' AND (v_dest IS NULL OR v_dest=v_source) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Document : dépôt destination invalide'; END IF;
 SELECT COUNT(*) INTO v_count FROM document_lines WHERE document_id=p_id;
 IF v_count=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Document sans lignes'; END IF;
 -- Acquire all balance rows in a global warehouse/product order, even for opposite transfers.
 INSERT INTO stock_balances(warehouse_id,product_id,quantity)
 SELECT w.id,l.product_id,0 FROM warehouses w JOIN document_lines l ON l.document_id=p_id
 WHERE w.id=v_source OR (v_kind='TRANSFER' AND w.id=v_dest) ORDER BY w.id,l.product_id
 ON DUPLICATE KEY UPDATE quantity=stock_balances.quantity;
 SET v_done=FALSE;
 OPEN movement_cursor;
 line_loop: LOOP
  FETCH movement_cursor INTO v_product,v_qty; IF v_done THEN LEAVE line_loop; END IF;
  SELECT quantity INTO v_stock FROM stock_balances WHERE warehouse_id=v_source AND product_id=v_product FOR UPDATE;
  IF v_kind IN ('OUT','TRANSFER') AND v_stock<v_qty THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='stock insuffisant'; END IF;
  UPDATE stock_balances SET quantity=quantity+IF(v_kind='IN',v_qty,-v_qty) WHERE warehouse_id=v_source AND product_id=v_product;
  INSERT INTO ledger(document_id,warehouse_id,product_id,quantity,occurred_at) VALUES(p_id,v_source,v_product,IF(v_kind='IN',v_qty,-v_qty),UTC_TIMESTAMP(6));
  IF v_kind='TRANSFER' THEN
   UPDATE stock_balances SET quantity=quantity+v_qty WHERE warehouse_id=v_dest AND product_id=v_product;
   INSERT INTO ledger(document_id,warehouse_id,product_id,quantity,occurred_at) VALUES(p_id,v_dest,v_product,v_qty,UTC_TIMESTAMP(6));
  END IF;
 END LOOP;
 CLOSE movement_cursor;
 SET v_year=YEAR(UTC_TIMESTAMP()); SET v_prefix=CASE v_kind WHEN 'IN' THEN 'ENT' WHEN 'OUT' THEN 'SOR' ELSE 'TRF' END;
 INSERT INTO counters(kind,year,value) VALUES(v_prefix,v_year,1) ON DUPLICATE KEY UPDATE value=value+1;
 SELECT value INTO v_counter FROM counters WHERE kind=v_prefix AND year=v_year FOR UPDATE;
 UPDATE documents SET status='validated',reference=CONCAT(v_prefix,'-',v_year,'-',LPAD(v_counter,6,'0')),validated_at=UTC_TIMESTAMP(6),idempotency_key=p_key WHERE id=p_id;
 INSERT INTO audit(user_id,action,document_id) VALUES(p_actor,'validate',p_id);
 COMMIT;
END$$
CREATE FUNCTION IF NOT EXISTS stock_level(q DECIMAL(18,3),m DECIMAL(18,3)) RETURNS VARCHAR(20) DETERMINISTIC NO SQL
RETURN CASE WHEN q=0 THEN 'Rupture' WHEN q<=m THEN 'Stock faible' ELSE 'En stock' END$$
DELIMITER ;
