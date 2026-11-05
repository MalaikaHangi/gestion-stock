CREATE OR REPLACE FUNCTION reverse_document(p_original INTEGER,p_actor INTEGER,p_reason TEXT,p_key TEXT) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d documents%ROWTYPE; old_reversal documents%ROWTYPE; line RECORD; v_new INTEGER; current_stock NUMERIC(18,3); company_warehouse INTEGER;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_actor AND active=1 AND role='admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_key IS NULL OR length(p_key)<8 OR p_reason IS NULL OR length(trim(p_reason))=0 THEN RAISE EXCEPTION 'Motif et clé requis'; END IF;
 SELECT stock_warehouse_id INTO company_warehouse FROM app_settings WHERE id=1;
 SELECT * INTO d FROM documents WHERE id=p_original FOR UPDATE;
 IF NOT FOUND OR d.status<>'validated' OR d.kind='REVERSAL' THEN RAISE EXCEPTION 'Document non contrepassable'; END IF;
 SELECT * INTO old_reversal FROM documents WHERE reversal_of=p_original;
 IF FOUND THEN IF old_reversal.idempotency_key=p_key THEN RETURN old_reversal.id; END IF; RAISE EXCEPTION 'Document déjà contrepassé'; END IF;
 INSERT INTO stock_balances(warehouse_id,product_id,quantity) SELECT company_warehouse,product_id,0 FROM ledger WHERE document_id=p_original GROUP BY product_id ORDER BY product_id ON CONFLICT DO NOTHING;
 PERFORM 1 FROM stock_balances b WHERE b.warehouse_id=company_warehouse AND b.product_id IN(SELECT product_id FROM ledger WHERE document_id=p_original) ORDER BY b.warehouse_id,b.product_id FOR UPDATE;
 INSERT INTO documents(kind,warehouse_id,reason,author_id,reversal_of) VALUES('REVERSAL',company_warehouse,p_reason,p_actor,p_original) RETURNING id INTO v_new;
 INSERT INTO document_lines(document_id,product_id,quantity,unit_cost) SELECT v_new,product_id,quantity,unit_cost FROM document_lines WHERE document_id=p_original;
 FOR line IN SELECT company_warehouse warehouse_id,product_id,sum(quantity) delta FROM ledger WHERE document_id=p_original GROUP BY product_id ORDER BY product_id LOOP
  SELECT quantity INTO current_stock FROM stock_balances WHERE warehouse_id=line.warehouse_id AND product_id=line.product_id;
  IF current_stock-line.delta<0 THEN RAISE EXCEPTION 'Stock insuffisant pour contrepasser'; END IF;
  UPDATE stock_balances SET quantity=quantity-line.delta WHERE warehouse_id=line.warehouse_id AND product_id=line.product_id;
  INSERT INTO ledger(document_id,warehouse_id,product_id,quantity,occurred_at) VALUES(v_new,line.warehouse_id,line.product_id,-line.delta,now());
 END LOOP;
 UPDATE documents SET reference=next_reference('CTR'),status='validated',validated_at=now(),idempotency_key=p_key WHERE id=v_new;
 INSERT INTO audit(user_id,action,document_id) VALUES(p_actor,'reverse',v_new);
 RETURN v_new;
END; $$;
