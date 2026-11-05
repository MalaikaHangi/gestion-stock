CREATE FUNCTION next_reference(p_kind TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_year SMALLINT:=extract(year FROM now() AT TIME ZONE 'UTC'); v_value BIGINT;
BEGIN
 INSERT INTO counters(kind,year,value) VALUES(p_kind,v_year,1) ON CONFLICT(kind,year) DO UPDATE SET value=counters.value+1 RETURNING value INTO v_value;
 RETURN p_kind||'-'||v_year||'-'||lpad(v_value::text,greatest(6,length(v_value::text)),'0');
END; $$;

CREATE FUNCTION validate_document(p_id INTEGER,p_actor INTEGER,p_key TEXT) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d documents%ROWTYPE; line RECORD; current_stock NUMERIC(18,3); delta NUMERIC(18,3);
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_actor AND active=1 AND role IN('admin','manager')) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_key IS NULL OR length(p_key)<8 THEN RAISE EXCEPTION 'Clé idempotente requise'; END IF;
 SELECT * INTO d FROM documents WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Document introuvable'; END IF;
 IF d.status='validated' AND d.idempotency_key=p_key THEN RETURN; END IF;
 IF d.status<>'draft' OR d.kind NOT IN('IN','OUT','TRANSFER') THEN RAISE EXCEPTION 'Document non validable'; END IF;
 IF d.kind='TRANSFER' AND (d.destination_id IS NULL OR d.destination_id=d.warehouse_id) THEN RAISE EXCEPTION 'Destination invalide'; END IF;
 IF NOT EXISTS(SELECT 1 FROM document_lines WHERE document_id=p_id) THEN RAISE EXCEPTION 'Document sans lignes'; END IF;
 INSERT INTO stock_balances(warehouse_id,product_id,quantity)
 SELECT w.id,l.product_id,0 FROM warehouses w CROSS JOIN document_lines l WHERE l.document_id=p_id AND (w.id=d.warehouse_id OR(d.kind='TRANSFER' AND w.id=d.destination_id)) ORDER BY w.id,l.product_id ON CONFLICT DO NOTHING;
 PERFORM 1 FROM stock_balances b WHERE (b.warehouse_id=d.warehouse_id OR(d.kind='TRANSFER' AND b.warehouse_id=d.destination_id)) AND b.product_id IN(SELECT product_id FROM document_lines WHERE document_id=p_id) ORDER BY b.warehouse_id,b.product_id FOR UPDATE;
 FOR line IN SELECT * FROM document_lines WHERE document_id=p_id ORDER BY product_id LOOP
  SELECT quantity INTO current_stock FROM stock_balances WHERE warehouse_id=d.warehouse_id AND product_id=line.product_id;
  IF d.kind IN('OUT','TRANSFER') AND current_stock<line.quantity THEN RAISE EXCEPTION 'Stock insuffisant'; END IF;
  delta:=CASE WHEN d.kind='IN' THEN line.quantity ELSE -line.quantity END;
  UPDATE stock_balances SET quantity=quantity+delta WHERE warehouse_id=d.warehouse_id AND product_id=line.product_id;
  INSERT INTO ledger(document_id,warehouse_id,product_id,quantity,occurred_at) VALUES(p_id,d.warehouse_id,line.product_id,delta,now());
  IF d.kind='TRANSFER' THEN
   UPDATE stock_balances SET quantity=quantity+line.quantity WHERE warehouse_id=d.destination_id AND product_id=line.product_id;
   INSERT INTO ledger(document_id,warehouse_id,product_id,quantity,occurred_at) VALUES(p_id,d.destination_id,line.product_id,line.quantity,now());
  END IF;
 END LOOP;
 UPDATE documents SET status='validated',reference=next_reference(CASE d.kind WHEN 'IN' THEN 'ENT' WHEN 'OUT' THEN 'SOR' ELSE 'TRF' END),validated_at=now(),idempotency_key=p_key WHERE id=p_id;
 INSERT INTO audit(user_id,action,document_id) VALUES(p_actor,'validate',p_id);
END; $$;

CREATE FUNCTION reverse_document(p_original INTEGER,p_actor INTEGER,p_reason TEXT,p_key TEXT) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d documents%ROWTYPE; old_reversal documents%ROWTYPE; line RECORD; v_new INTEGER; current_stock NUMERIC(18,3);
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_actor AND active=1 AND role='admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_key IS NULL OR length(p_key)<8 OR p_reason IS NULL OR length(trim(p_reason))=0 THEN RAISE EXCEPTION 'Motif et clé requis'; END IF;
 SELECT * INTO d FROM documents WHERE id=p_original FOR UPDATE;
 IF NOT FOUND OR d.status<>'validated' OR d.kind='REVERSAL' THEN RAISE EXCEPTION 'Document non contrepassable'; END IF;
 SELECT * INTO old_reversal FROM documents WHERE reversal_of=p_original;
 IF FOUND THEN IF old_reversal.idempotency_key=p_key THEN RETURN old_reversal.id; END IF; RAISE EXCEPTION 'Document déjà contrepassé'; END IF;
 INSERT INTO stock_balances(warehouse_id,product_id,quantity) SELECT warehouse_id,product_id,0 FROM ledger WHERE document_id=p_original GROUP BY warehouse_id,product_id ORDER BY warehouse_id,product_id ON CONFLICT DO NOTHING;
 PERFORM 1 FROM stock_balances b WHERE (b.warehouse_id,b.product_id) IN(SELECT warehouse_id,product_id FROM ledger WHERE document_id=p_original) ORDER BY b.warehouse_id,b.product_id FOR UPDATE;
 INSERT INTO documents(kind,warehouse_id,reason,author_id,reversal_of) VALUES('REVERSAL',d.warehouse_id,p_reason,p_actor,p_original) RETURNING id INTO v_new;
 INSERT INTO document_lines(document_id,product_id,quantity,unit_cost) SELECT v_new,product_id,quantity,unit_cost FROM document_lines WHERE document_id=p_original;
 FOR line IN SELECT warehouse_id,product_id,sum(quantity) delta FROM ledger WHERE document_id=p_original GROUP BY warehouse_id,product_id ORDER BY warehouse_id,product_id LOOP
  SELECT quantity INTO current_stock FROM stock_balances WHERE warehouse_id=line.warehouse_id AND product_id=line.product_id;
  IF current_stock-line.delta<0 THEN RAISE EXCEPTION 'Stock insuffisant pour contrepasser'; END IF;
  UPDATE stock_balances SET quantity=quantity-line.delta WHERE warehouse_id=line.warehouse_id AND product_id=line.product_id;
  INSERT INTO ledger(document_id,warehouse_id,product_id,quantity,occurred_at) VALUES(v_new,line.warehouse_id,line.product_id,-line.delta,now());
 END LOOP;
 UPDATE documents SET reference=next_reference('CTR'),status='validated',validated_at=now(),idempotency_key=p_key WHERE id=v_new;
 INSERT INTO audit(user_id,action,document_id) VALUES(p_actor,'reverse',v_new);
 RETURN v_new;
END; $$;
