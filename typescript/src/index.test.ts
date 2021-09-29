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

    test("insert-node & search-node-by-id", async () => {
        await db.insertNode({ id: "1" });
        const result = await db.searchNodeById("1");
        expect(result).toEqual({ id: "1" })
    })

    test("insert-edge", async () => {
        await db.insertNode({ id: "1" });
        await db.insertNode({ id: "2" });
        await db.insertEdge("1", "2");
        const result1 = await db.searchNodeById("1");
        expect(result1).toEqual({ id: "1" })
        const result2 = await db.searchNodeById("2");
        expect(result2).toEqual({ id: "2" })
    })

    afterEach(() => {
        db.close();
    })
})