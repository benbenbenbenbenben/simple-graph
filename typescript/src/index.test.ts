type Unwrap<P> = P extends Promise<infer T> ? Unwrap<T> : P;
import { createDb, whereClauseToSql } from "./index"
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

        const result = db.getNodeById("1");
        expect(result).toEqual({ id: "1" });

        db.deleteNode("1");
        const deleted = db.getNodeById("1");
        expect(deleted).toBeUndefined();
    })

    test("insert-edge & search-edges & search-edge-by-id & delete-edge", async () => {
        db.insertNode({ id: "1" });
        db.insertNode({ id: "2" });
        db.insertEdge({ source: "1", target: "2", id: "12abc", fact: "abc" });
        const result1 = db.getNodeById("1");
        expect(result1).toEqual({ id: "1" })
        const result2 = db.getNodeById("2");
        expect(result2).toEqual({ id: "2" })

        // from-to
        const edgeFT = db.getEdges("1", "2");
        expect([...edgeFT]).toEqual([{ source: "1", target: "2", id: "12abc", fact: "abc" }]);

        // to-from
        const edgeTF = db.getEdges("2", "1", "toFrom");
        expect([...edgeTF]).toEqual([{ source: "1", target: "2", id: "12abc", fact: "abc" }]);

        // both
        const edgeXX = db.getEdges("2", "1", "both");
        expect([...edgeXX]).toEqual([{ source: "1", target: "2", id: "12abc", fact: "abc" }]);

        const edge = db.getEdgeById("12abc")!
        db.deleteEdge(edge.id);
        const noEdge = db.getEdgeById(edge.id);
        expect(noEdge).toBeUndefined();
    })

    test("searchNodes", () => {
        type nodeType = {
            id: string
            field: string
        }
        db.insertNode<nodeType>({ id: "a", field: "value" })
        const nodes = [...db.searchNodes<nodeType>({ field: { eq: "value" } })]
        expect(nodes).toStrictEqual([{ id: "a", field: "value" }])
    })

    test("searchEdges", () => {
        type nodeType = {
            id: string
            field: string
        }
        db.insertNode<nodeType>({ id: "a", field: "value" })
        db.insertNode<nodeType>({ id: "b", field: "value" })
        db.insertEdge({ source: "a", target: "b", meta: "data" })
        const edges = [...db.searchEdges<{ meta: string }>({ meta: { eq: "data" } })]
        expect(edges).toStrictEqual([{
            id: "a:b",
            source: "a",
            target: "b",
            meta: "data"
        }])
    })

    test("insert-node & update-node", async () => {
        db.insertNode({
            id: "a",
            tag: "0"
        })
        expect(db.getNodeById("a")).toEqual({ id: "a", tag: "0" })
        db.updateNode({
            id: "a",
            tag: "1"
        })
        expect(db.getNodeById("a")).toEqual({ id: "a", tag: "1" })
    })

    test("whereClauseToSql", () => {
        type fooBar = {
            foo: string,
            bar: string,
        }
        const explicitAndClause = whereClauseToSql<fooBar>({
            foo: { eq: "bar" },
            AND: { bar: { eq: "foo" } }
        })
        expect(explicitAndClause.sql).toBe("foo = :0 AND (bar = :1)")

        const implicitAndClause = whereClauseToSql<fooBar>({
            foo: { eq: "bar" },
            bar: { eq: "foo" }
        })
        expect(implicitAndClause.sql).toBe("foo = :0 AND bar = :1")

        const explicitOrClause = whereClauseToSql<fooBar>({
            foo: { eq: "bar" },
            OR: { bar: { eq: "foo" } }
        })
        expect(explicitOrClause.sql).toBe("foo = :0 OR (bar = :1)")
    })

    test("whereClauseToSql jsonField=root", () => {
        type fooBar = {
            foo: string,
            bar: string,
        }
        const explicitAndClause = whereClauseToSql<fooBar>({
            foo: { eq: "bar" },
            AND: { bar: { eq: "foo" } }
        }, "root")
        expect(explicitAndClause.sql).toBe("json_extract(root, '$.foo') = :0 AND (json_extract(root, '$.bar') = :1)")

        const implicitAndClause = whereClauseToSql<fooBar>({
            foo: { eq: "bar" },
            bar: { eq: "foo" }
        }, "root")
        expect(implicitAndClause.sql).toBe("json_extract(root, '$.foo') = :0 AND json_extract(root, '$.bar') = :1")

        const explicitOrClause = whereClauseToSql<fooBar>({
            foo: { eq: "bar" },
            OR: { bar: { eq: "foo" } }
        }, "root")
        expect(explicitOrClause.sql).toBe("json_extract(root, '$.foo') = :0 OR (json_extract(root, '$.bar') = :1)")
    })

    test("traverse", () => {
        db.insertNode({ id: "a" })
        db.insertNode({ id: "b" })
        db.insertNode({ id: "c" })
        db.insertNode({ id: "d" })
        db.insertNode({ id: "e" })
        db.insertEdge({ source: "a", target: "b" })
        db.insertEdge({ source: "b", target: "c" })
        db.insertEdge({ source: "c", target: "d" })
        db.insertEdge({ source: "d", target: "e" })

        expect([...db.traverse("a")]).toStrictEqual([
            { id: "a", kind: "node" },
            { id: "a:b", kind: "targets" },
            { id: "b", kind: "node" },
            { id: "a:b", kind: "sources" },
            { id: "b:c", kind: "targets" },
            { id: "c", kind: "node" },
            { id: "b:c", kind: "sources" },
            { id: "c:d", kind: "targets" },
            { id: "d", kind: "node" },
            { id: "c:d", kind: "sources" },
            { id: "d:e", kind: "targets" },
            { id: "e", kind: "node" },
            { id: "d:e", kind: "sources" },
        ])
    })

    test("traverseWithBody", () => {
        db.insertNode({ id: "a" })
        db.insertNode({ id: "b" })
        db.insertNode({ id: "c" })
        db.insertNode({ id: "d" })
        db.insertNode({ id: "e" })
        db.insertEdge({ source: "a", target: "b" })
        db.insertEdge({ source: "b", target: "c" })
        db.insertEdge({ source: "c", target: "d" })
        db.insertEdge({ source: "d", target: "e" })

        const results = [...db.traverseWithBody("a")]
        expect(results).toStrictEqual([
            { id: "a", kind: "node", node: { id: "a" } },
            { id: "a:b", kind: "targets", targets: { id: "a:b", source: "a", target: "b" } },
            { id: "b", kind: "node", node: { id: "b" } },
            { id: "a:b", kind: "sources", sources: { id: "a:b", source: "a", target: "b" } },
            { id: "b:c", kind: "targets", targets: { id: "b:c", source: "b", target: "c" } },
            { id: "c", kind: "node", node: { id: "c" } },
            { id: "b:c", kind: "sources", sources: { id: "b:c", source: "b", target: "c" } },
            { id: "c:d", kind: "targets", targets: { id: "c:d", source: "c", target: "d" } },
            { id: "d", kind: "node", node: { id: "d" } },
            { id: "c:d", kind: "sources", sources: { id: "c:d", source: "c", target: "d" } },
            { id: "d:e", kind: "targets", targets: { id: "d:e", source: "d", target: "e" } },
            { id: "e", kind: "node", node: { id: "e" } },
            { id: "d:e", kind: "sources", sources: { id: "d:e", source: "d", target: "e" } },
        ])
    })

    afterEach(() => {
        db.close();
    })
})