type Unwrap<P> = P extends Promise<infer T> ? Unwrap<T> : P;
import type { createDb } from "./index"
import sqlite, { Database } from "sql.js";
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
    const { createDb } = await import("./index")
    const db = createDb();
    (await db).close();
})

describe("sql", () => {
    let db: Unwrap<ReturnType<typeof createDb>>;
    beforeEach(async () => {
        const { createDb } = await import("./index")
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

    test("insert-edge & search-edges & search-edge-by-id & delete-edge", async () => {
        db.insertNode({ id: "1" });
        db.insertNode({ id: "2" });
        db.insertEdge("1", "2", { id: "12abc", fact: "abc" });
        const result1 = db.searchNodeById("1");
        expect(result1).toEqual({ id: "1" })
        const result2 = db.searchNodeById("2");
        expect(result2).toEqual({ id: "2" })

        // from-to
        const edgeFT = db.searchEdges("1", "2");
        expect([...edgeFT]).toEqual([{ source: "1", target: "2", id: "12abc", properties: { id: "12abc", fact: "abc" } }]);

        // to-from
        const edgeTF = db.searchEdges("2", "1", "toFrom");
        expect([...edgeTF]).toEqual([{ source: "1", target: "2", id: "12abc", properties: { id: "12abc", fact: "abc" } }]);

        // both
        const edgeXX = db.searchEdges("2", "1", "both");
        expect([...edgeXX]).toEqual([{ source: "1", target: "2", id: "12abc", properties: { id: "12abc", fact: "abc" } }]);

        const edge = db.searchEdgeById("12abc")!
        db.deleteEdge(edge.id);
        const noEdge = db.searchEdgeById(edge.id);
        expect(noEdge).toBeUndefined();
    })

    afterEach(() => {
        db.close();
    })
})