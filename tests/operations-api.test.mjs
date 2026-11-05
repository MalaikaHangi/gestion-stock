import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { randomBytes, scryptSync } from "node:crypto";
import net from "node:net";
const require = createRequire(import.meta.url);
test(
  "API : deux rôles, entrées/sorties, correction, filtres et protection des historiques",
  { skip: !process.env.TEST_DATABASE_URL, timeout: 90000 },
  async () => {
    const { createDatabase } = await import("../backend/lib/postgres.mjs");
    const db = createDatabase(process.env.TEST_DATABASE_URL);
    const reserve = net.createServer();
    await new Promise((resolve) => reserve.listen(0, "127.0.0.1", resolve));
    const port = reserve.address().port;
    await new Promise((resolve) => reserve.close(resolve));
    const server = spawn(
      process.execPath,
      [
        require.resolve("../backend/node_modules/next/dist/bin/next"),
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        cwd: new URL("../backend/", import.meta.url),
        env: {
          ...process.env,
          DATABASE_URL: process.env.TEST_DATABASE_URL,
          NODE_ENV: "production",
          ALLOWED_ORIGINS: "https://frontend.example.invalid",
        },
        stdio: "ignore",
        windowsHide: true,
      },
    );
    const base = "http://127.0.0.1:" + port;
    const suffix = randomBytes(6).toString("hex");
    const password = randomBytes(16).toString("hex");
    let adminToken, managerToken;
    const userIds = [],
      docIds = [],
      categoryIds = [],
      productIds = [],
      unitIds = [],
      warehouseIds = [];
    async function request(
      path,
      method = "GET",
      body,
      token = adminToken,
      key,
    ) {
      const response = await fetch(base + path, {
        method,
        headers: {
          Origin: "https://frontend.example.invalid",
          ...(token ? { Authorization: "Bearer " + token } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return {
        status: response.status,
        data: await response.json(),
        headers: response.headers,
      };
    }
    const success = async (path, method, body, token, key) => {
      const r = await request(path, method, body, token, key);
      assert.ok(
        r.status >= 200 && r.status < 300,
        JSON.stringify({ path, status: r.status, data: r.data }),
      );
      return r.data;
    };
    try {
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        try {
          ready = (await fetch(base + "/api/health")).ok;
        } catch {}
        if (ready) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      assert.equal(ready, true, "API de test disponible");
      for (const role of ["admin", "manager"]) {
        const salt = randomBytes(16).toString("hex");
        const [r] = await db.execute(
          "INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)",
          [
            "Test " + role,
            "api-" + role + "-" + suffix + "@example.com",
            salt + ":" + scryptSync(password, salt, 64).toString("hex"),
            role,
          ],
        );
        userIds.push(r.insertId);
      }
      const login = await request(
        "/api/auth",
        "POST",
        { email: "api-admin-" + suffix + "@example.com", password },
        null,
      );
      assert.equal(login.status, 200);
      assert.equal(
        login.headers.get("access-control-allow-origin"),
        "https://frontend.example.invalid",
      );
      adminToken = login.data.token;
      managerToken = (
        await success(
          "/api/auth",
          "POST",
          { email: "api-manager-" + suffix + "@example.com", password },
          null,
        )
      ).token;
      assert.equal(
        (await request("/api/users", "GET", undefined, managerToken)).status,
        403,
      );
      assert.equal(
        (
          await request(
            "/api/users",
            "POST",
            {
              name: "Denied",
              email: "denied@example.com",
              role: "admin",
              active: true,
              password,
            },
            managerToken,
          )
        ).status,
        403,
      );
      const category = await success("/api/references/categories", "POST", {
        name: "Test " + suffix,
        active: true,
      });
      categoryIds.push(category.id);
      const child = await success("/api/references/categories", "POST", {
        name: "Child " + suffix,
        parent_id: category.id,
        active: true,
      });
      categoryIds.push(child.id);
      assert.equal(
        (
          await request("/api/references/categories", "PUT", {
            id: category.id,
            name: "Cycle",
            parent_id: child.id,
            active: true,
          })
        ).status,
        409,
      );
      const values = {
        name: "Article API " + suffix,
        category_id: category.id,
        minimum: "5",
        cost: "10",
        active: true,
      };
      assert.equal(
        (await request("/api/catalog", "POST", values, managerToken)).status,
        403,
      );
      const product = await success("/api/catalog", "POST", values);
      productIds.push(product.id);
      const [autoSku] = await db.execute(
        "SELECT sku FROM products WHERE id=?",
        [product.id],
      );
      assert.match(autoSku[0].sku, /^ART-\d{8,}$/);
      async function draft(
        kind,
        quantity,
        key = randomBytes(8).toString("hex"),
      ) {
        const body = {
          kind,
          lines: [{ product_id: product.id, quantity }],
        };
        const result = await success(
          "/api/documents",
          "POST",
          body,
          managerToken,
          key,
        );
        if (!docIds.includes(result.id)) docIds.push(result.id);
        return { id: result.id, body, key };
      }
      const entry = await draft("IN", "25");
      const repeated = await success(
        "/api/documents",
        "POST",
        entry.body,
        managerToken,
        entry.key,
      );
      assert.equal(repeated.id, entry.id);
      assert.equal(
        (
          await request(
            "/api/documents",
            "POST",
            {
              ...entry.body,
              lines: [{ product_id: product.id, quantity: "99" }],
            },
            managerToken,
            entry.key,
          )
        ).status,
        409,
      );
      await success(
        "/api/documents/" + entry.id + "/validate",
        "POST",
        undefined,
        managerToken,
        "api-validate-" + entry.id,
      );
      await success(
        "/api/documents/" + entry.id + "/validate",
        "POST",
        undefined,
        managerToken,
        "api-validate-" + entry.id,
      );
      assert.equal(
        (
          await request(
            "/api/documents/" + entry.id,
            "PUT",
            entry.body,
            managerToken,
          )
        ).status,
        409,
      );
      const out = await draft("OUT", "7");
      await success(
        "/api/documents/" + out.id + "/validate",
        "POST",
        undefined,
        managerToken,
        "api-validate-" + out.id,
      );
      assert.equal(
        (
          await request(
            "/api/documents/" + out.id + "/reverse",
            "POST",
            { reason: "Denied" },
            managerToken,
            "api-reverse-" + out.id,
          )
        ).status,
        403,
      );
      await success(
        "/api/documents/" + out.id + "/reverse",
        "POST",
        { reason: "Correction API" },
        adminToken,
        "api-reverse-" + out.id,
      );
      const [reversed] = await db.execute(
        "SELECT id FROM documents WHERE reversal_of=?",
        [out.id],
      );
      docIds.push(reversed[0].id);
      const cancelled = await draft("OUT", "1");
      await success(
        "/api/documents/" + cancelled.id,
        "DELETE",
        undefined,
        managerToken,
      );
      assert.equal(
        (
          await request(
            "/api/documents/" + cancelled.id + "/validate",
            "POST",
            undefined,
            managerToken,
            "api-validate-" + cancelled.id,
          )
        ).status,
        409,
      );
      const [a, b] = await Promise.all([
        draft("OUT", "20"),
        draft("OUT", "20"),
      ]);
      const simultaneous = await Promise.all([
        request(
          "/api/documents/" + a.id + "/validate",
          "POST",
          undefined,
          managerToken,
          "api-validate-" + a.id,
        ),
        request(
          "/api/documents/" + b.id + "/validate",
          "POST",
          undefined,
          managerToken,
          "api-validate-" + b.id,
        ),
      ]);
      assert.equal(simultaneous.filter((r) => r.status === 200).length, 1);
      assert.equal(simultaneous.filter((r) => r.status === 409).length, 1);
      const report = await success(
        "/api/stock",
        undefined,
        undefined,
        managerToken,
      );
      const row = report.items.find((p) => p.id === product.id);
      assert.equal(Number(row.closing), 5);
      assert.equal(
        Number(row.opening) + Number(row.incoming) - Number(row.outgoing),
        5,
      );
      const filtered = await success(
        "/api/documents?kind=IN&q=" + suffix,
        undefined,
        undefined,
        managerToken,
      );
      assert.equal(filtered.total, 1);
      assert.equal(filtered.items[0].id, entry.id);
      const detail = await success(
        "/api/documents/" + out.id,
        undefined,
        undefined,
        managerToken,
      );
      assert.equal(detail.lines[0].quantity, "7.000");
      assert.ok(detail.reversed_by);
      assert.equal(
        (await request("/api/catalog/" + product.id, "DELETE")).status,
        409,
      );
      const [beforeCount] = await db.execute(
        "SELECT quantity FROM stock_balances WHERE product_id=?",
        [product.id],
      );
      const expected = beforeCount[0].quantity;
      const countBody = { product_id: product.id, expected, counted: "12.000" };
      assert.equal(
        (
          await request(
            "/api/inventory",
            "POST",
            countBody,
            managerToken,
            "manager-count-denied",
          )
        ).status,
        403,
      );
      const correction = await success(
        "/api/inventory",
        "POST",
        countBody,
        adminToken,
        "count-test-" + suffix,
      );
      if (correction.document_id) docIds.push(correction.document_id);
      const repeatCount = await success(
        "/api/inventory",
        "POST",
        countBody,
        adminToken,
        "count-test-" + suffix,
      );
      assert.equal(repeatCount.id, correction.id);
      assert.equal(
        (
          await request(
            "/api/inventory",
            "POST",
            { ...countBody, expected: "999" },
            adminToken,
            "stale-count-" + suffix,
          )
        ).status,
        409,
      );
      const [afterCount] = await db.execute(
        "SELECT quantity FROM stock_balances WHERE product_id=?",
        [product.id],
      );
      assert.equal(afterCount[0].quantity, "12.000");
      const managerId = userIds[1];
      await success("/api/users", "PUT", {
        id: managerId,
        name: "Responsable désactivé",
        email: "api-manager-" + suffix + "@example.com",
        role: "manager",
        active: false,
      });
      assert.equal(
        (await request("/api/catalog", "GET", undefined, managerToken)).status,
        401,
      );
    } finally {
      server.kill();
      for (const id of productIds)
        await db.execute("DELETE FROM stock_counts WHERE product_id=?", [id]);
      if (docIds.length) {
        const marks = docIds.map(() => "?").join(",");
        for (const table of ["audit", "ledger", "document_lines"])
          await db.execute(
            `DELETE FROM ${table} WHERE document_id IN (${marks})`,
            docIds,
          );
        await db.execute(
          `DELETE FROM documents WHERE reversal_of IS NOT NULL AND id IN (${marks})`,
          docIds,
        );
        await db.execute(
          `DELETE FROM documents WHERE id IN (${marks})`,
          docIds,
        );
      }
      for (const id of productIds) {
        await db.execute("DELETE FROM stock_balances WHERE product_id=?", [id]);
        await db.execute("DELETE FROM products WHERE id=?", [id]);
      }
      for (const id of [...categoryIds].reverse())
        await db.execute("DELETE FROM categories WHERE id=?", [id]);
      for (const [table, ids] of [
        ["units", unitIds],
        ["warehouses", warehouseIds],
      ])
        for (const id of ids)
          await db.execute(`DELETE FROM ${table} WHERE id=?`, [id]);
      for (const id of userIds) {
        await db.execute("DELETE FROM audit WHERE user_id=?", [id]);
        await db.execute("DELETE FROM sessions WHERE user_id=?", [id]);
        await db.execute("DELETE FROM users WHERE id=?", [id]);
      }
      await db.end();
    }
  },
);
