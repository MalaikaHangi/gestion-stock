import test from "node:test";
import assert from "node:assert/strict";
// Dedicated disposable database only. Apply migrations first; never use a production URL.
test(
  "MySQL : atomicité, concurrence, transfert et idempotence",
  { skip: !process.env.TEST_MYSQL_URL },
  async () => {
    const { default: mysql } = await import(
      "../backend/node_modules/mysql2/promise.js"
    );
    const pool = mysql.createPool(process.env.TEST_MYSQL_URL);
    let actor,
      admin,
      category,
      unit,
      source,
      destination,
      product,
      secondProduct;
    const documentIds = [];
    const insert = async (sql, args = []) => {
      const [r] = await pool.execute(sql, args);
      return r.insertId;
    };
    const suffix = Date.now().toString();
    try {
      actor = await insert(
        "INSERT INTO users(name,email,password_hash,role) VALUES ('Test',?,'unused','manager')",
        ["test-" + suffix + "@example.com"],
      );
      admin = await insert(
        "INSERT INTO users(name,email,password_hash,role) VALUES ('Test admin',?,'unused','admin')",
        ["admin-test-" + suffix + "@example.com"],
      );
      category = await insert("INSERT INTO categories(name) VALUES ('Test')");
      unit = await insert("INSERT INTO units(name) VALUES (?)", [
        "test-" + suffix,
      ]);
      source = await insert(
        "INSERT INTO warehouses(name) VALUES ('Test source')",
      );
      destination = await insert(
        "INSERT INTO warehouses(name) VALUES ('Test destination')",
      );
      product = await insert(
        "INSERT INTO products(sku,name,category_id,unit_id) VALUES (?,'Test',?,?)",
        ["test-" + suffix, category, unit],
      );
      async function draft(kind, quantity, dest = null) {
        const id = await insert(
          "INSERT INTO documents(kind,warehouse_id,destination_id,reason,author_id) VALUES (?,?,?,'Test',?)",
          [kind, source, dest, actor],
        );
        documentIds.push(id);
        await insert(
          "INSERT INTO document_lines(document_id,product_id,quantity) VALUES (?,?,?)",
          [id, product, quantity],
        );
        return id;
      }
      const validate = (id) =>
        pool.execute("CALL validate_document(?,?,?)", [
          id,
          actor,
          "test-validation-" + id,
        ]);
      const balance = async (warehouse) => {
        const [r] = await pool.execute(
          "SELECT quantity FROM stock_balances WHERE warehouse_id=? AND product_id=?",
          [warehouse, product],
        );
        return Number(r[0]?.quantity || 0);
      };
      const entry = await draft("IN", "100");
      await validate(entry);
      await validate(entry);
      assert.equal(await balance(source), 100);
      await validate(await draft("OUT", "30"));
      assert.equal(await balance(source), 70);
      await assert.rejects(validate(await draft("OUT", "71")));
      assert.equal(await balance(source), 70);
      await validate(await draft("TRANSFER", "20", destination));
      assert.equal(await balance(source), 50);
      assert.equal(await balance(destination), 20);
      const out = await draft("OUT", "40");
      await validate(out);
      const a = await draft("OUT", "8"),
        b = await draft("OUT", "8");
      const results = await Promise.allSettled([validate(a), validate(b)]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(await balance(source), 2);
      secondProduct = await insert(
        "INSERT INTO products(sku,name,category_id,unit_id) VALUES (?,'Test seconde ligne',?,?)",
        ["test-second-" + suffix, category, unit],
      );
      const multiline = await draft("OUT", "1");
      await insert(
        "INSERT INTO document_lines(document_id,product_id,quantity) VALUES (?,?,1)",
        [multiline, secondProduct],
      );
      await assert.rejects(validate(multiline));
      assert.equal(await balance(source), 2);
      await assert.rejects(
        pool.execute("CALL reverse_document(?,?,?,?)", [
          out,
          actor,
          "Correction test",
          "test-reverse-" + out,
        ]),
      );
      await pool.execute("CALL reverse_document(?,?,?,?)", [
        out,
        admin,
        "Correction test",
        "test-reverse-" + out,
      ]);
      const [reversed] = await pool.execute(
        "SELECT id FROM documents WHERE reversal_of=?",
        [out],
      );
      documentIds.push(reversed[0].id);
      assert.equal(await balance(source), 42);
      await pool.execute("CALL reverse_document(?,?,?,?)", [
        out,
        admin,
        "Correction test",
        "test-reverse-" + out,
      ]);
      assert.equal(await balance(source), 42);
      const [ledger] = await pool.execute(
        "SELECT SUM(quantity) quantity FROM ledger WHERE warehouse_id=? AND product_id=?",
        [source, product],
      );
      assert.equal(Number(ledger[0].quantity), 42);
    } finally {
      if (documentIds.length) {
        const marks = documentIds.map(() => "?").join(",");
        for (const table of ["audit", "ledger", "document_lines"])
          await pool.execute(
            `DELETE FROM ${table} WHERE document_id IN (${marks})`,
            documentIds,
          );
        await pool.execute(
          `DELETE FROM documents WHERE reversal_of IS NOT NULL AND id IN (${marks})`,
          documentIds,
        );
        await pool.execute(
          `DELETE FROM documents WHERE id IN (${marks})`,
          documentIds,
        );
      }
      if (secondProduct) {
        await pool.execute("DELETE FROM stock_balances WHERE product_id=?", [
          secondProduct,
        ]);
        await pool.execute("DELETE FROM products WHERE id=?", [secondProduct]);
      }
      if (product) {
        await pool.execute("DELETE FROM stock_balances WHERE product_id=?", [
          product,
        ]);
        await pool.execute("DELETE FROM products WHERE id=?", [product]);
      }
      for (const [table, id] of [
        ["warehouses", source],
        ["warehouses", destination],
        ["units", unit],
        ["categories", category],
        ["users", actor],
        ["users", admin],
      ])
        if (id) await pool.execute(`DELETE FROM ${table} WHERE id=?`, [id]);
      await pool.end();
    }
  },
);
