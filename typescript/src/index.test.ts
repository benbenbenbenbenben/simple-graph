type Unwrap<P> = P extends Promise<infer T> ? Unwrap<T> : P;

import sqlite, { Database } from "sql.js";
import { createDb } from "./index";
let db: Database;

beforeAll(async () => {
    const sql = await sqlite();
    db = new sql.Database();
})

afterAll(async () => {
    db.close();
})

test("sql.js is okay", async () => {
    const result = db.exec("SELECT 1;")
    expect(result).toStrictEqual([{ "columns": ["1"], "values": [[1]] }]);
})

test("schema is okay", async () => {
    const db = createDb();
    (await db).close();
})

describe("sql", () => {
    let db: Unwrap<ReturnType<typeof createDb>>;
    beforeEach(async () => {
        db = await createDb();
    })

    test("insert-node & search-node-by-id & delete-node", async () => {
        await db.insertNode({ id: "1" });

        const result = db.searchNodeById("1");
        expect(result).toEqual({ id: "1" });

        db.deleteNode("1");
        const deleted = db.searchNodeById("1");
        expect(deleted).toBeUndefined();
    })

    test("insert-edge & search-edges", async () => {
        db.insertNode({ id: "1" });
        db.insertNode({ id: "2" });
        db.insertEdge("1", "2", { fact: "abc" });
        const result1 = db.searchNodeById("1");
        expect(result1).toEqual({ id: "1" })
        const result2 = db.searchNodeById("2");
        expect(result2).toEqual({ id: "2" })

        // from-to
        const edgeFT = db.searchEdges("1", "2");
        expect([...edgeFT]).toEqual([{ source: "1", target: "2", properties: { fact: "abc" } }]);

        // to-from
        const edgeTF = db.searchEdges("2", "1", "toFrom");
        expect([...edgeTF]).toEqual([{ source: "1", target: "2", properties: { fact: "abc" } }]);

        // both
        const edgeXX = db.searchEdges("2", "1", "both");
        expect([...edgeXX]).toEqual([{ source: "1", target: "2", properties: { fact: "abc" } }]);
    })

    afterEach(() => {
        db.close();
    })
})