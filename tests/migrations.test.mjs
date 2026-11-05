import test from "node:test";
import assert from "node:assert/strict";
import { splitStatements } from "../backend/scripts/sql-statements.mjs";
test("SQL : les points-virgules dans les textes et commentaires ne coupent pas les instructions", () => {
  assert.deepEqual(
    splitStatements(
      "-- premier;\nINSERT INTO t VALUES ('a; b', 'l''article'); /* second; */ SELECT `a;b` FROM t;",
    ),
    ["INSERT INTO t VALUES ('a; b', 'l''article')", "SELECT `a;b` FROM t"],
  );
  assert.throws(() => splitStatements("SELECT 'incomplet"));
});
