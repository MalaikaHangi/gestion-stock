DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS reverse_document(IN p_original BIGINT UNSIGNED,IN p_actor BIGINT UNSIGNED,IN p_reason VARCHAR(255),IN p_key VARCHAR(100))
proc: BEGIN
 DECLARE v_status VARCHAR(20); DECLARE v_kind VARCHAR(20); DECLARE v_source BIGINT UNSIGNED; DECLARE v_new BIGINT UNSIGNED; DECLARE v_existing BIGINT UNSIGNED;
 DECLARE v_warehouse BIGINT UNSIGNED; DECLARE v_product BIGINT UNSIGNED; DECLARE v_delta DECIMAL(18,3); DECLARE v_stock DECIMAL(18,3); DECLARE v_done BOOLEAN DEFAULT FALSE;
 DECLARE v_year SMALLINT; DECLARE v_counter BIGINT; DECLARE v_count INT; DECLARE v_key VARCHAR(100);
 DECLARE reversal_cursor CURSOR FOR SELECT warehouse_id,product_id,SUM(quantity) FROM ledger WHERE document_id=p_original GROUP BY warehouse_id,product_id ORDER BY warehouse_id,product_id;
 DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done=TRUE;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 START TRANSACTION;
 SELECT COUNT(*) INTO v_count FROM users WHERE id=p_actor AND role='admin' AND active=1;
 IF v_count<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FORBIDDEN'; END IF;
 IF p_key IS NULL OR LENGTH(p_key)<8 OR p_reason IS NULL OR LENGTH(TRIM(p_reason))=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Document : motif et clé requis'; END IF;
 SELECT status,kind,warehouse_id INTO v_status,v_kind,v_source FROM documents WHERE id=p_original FOR UPDATE;
 IF v_done OR v_status<>'validated' OR v_kind='REVERSAL' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Document non contrepassable'; END IF;
 SELECT COUNT(*),MAX(id),MAX(idempotency_key) INTO v_count,v_existing,v_key FROM documents WHERE reversal_of=p_original;
 IF v_count>0 THEN
  IF v_key=p_key THEN COMMIT; SELECT v_existing id; LEAVE proc; END IF;
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Document déjà contrepassé';
 END IF;
 INSERT INTO stock_balances(warehouse_id,product_id,quantity) SELECT warehouse_id,product_id,0 FROM ledger WHERE document_id=p_original GROUP BY warehouse_id,product_id ORDER BY warehouse_id,product_id ON DUPLICATE KEY UPDATE quantity=stock_balances.quantity;
 INSERT INTO documents(kind,warehouse_id,reason,author_id,reversal_of) VALUES('REVERSAL',v_source,p_reason,p_actor,p_original); SET v_new=LAST_INSERT_ID();
 INSERT INTO document_lines(document_id,product_id,quantity,unit_cost) SELECT v_new,product_id,quantity,unit_cost FROM document_lines WHERE document_id=p_original;
 SET v_done=FALSE; OPEN reversal_cursor;
 reverse_loop: LOOP
  FETCH reversal_cursor INTO v_warehouse,v_product,v_delta; IF v_done THEN LEAVE reverse_loop; END IF;
  SELECT quantity INTO v_stock FROM stock_balances WHERE warehouse_id=v_warehouse AND product_id=v_product FOR UPDATE;
  IF v_stock-v_delta<0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='stock insuffisant pour contrepasser'; END IF;
  UPDATE stock_balances SET quantity=quantity-v_delta WHERE warehouse_id=v_warehouse AND product_id=v_product;
  INSERT INTO ledger(document_id,warehouse_id,product_id,quantity,occurred_at) VALUES(v_new,v_warehouse,v_product,-v_delta,UTC_TIMESTAMP(6));
 END LOOP; CLOSE reversal_cursor;
 SET v_year=YEAR(UTC_TIMESTAMP());
 INSERT INTO counters(kind,year,value) VALUES('CTR',v_year,1) ON DUPLICATE KEY UPDATE value=value+1;
 SELECT value INTO v_counter FROM counters WHERE kind='CTR' AND year=v_year FOR UPDATE;
 UPDATE documents SET reference=CONCAT('CTR-',v_year,'-',LPAD(v_counter,6,'0')),status='validated',validated_at=UTC_TIMESTAMP(6),idempotency_key=p_key WHERE id=v_new;
 INSERT INTO audit(user_id,action,document_id) VALUES(p_actor,'reverse',v_new);
 COMMIT; SELECT v_new id;
END$$
DELIMITER ;
