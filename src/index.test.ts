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
        await db.insertVertex({ id: "1" });

        const result = db.getVertexById("1");
        expect(result).toEqual({ id: "1", name: null, ns: null, props: null, type: "vertex" });

        db.deleteVertex("1");
        const deleted = db.getVertexById("1");
        expect(deleted).toBeUndefined();
    })

    test("insert-edge & search-edges & search-edge-by-id & delete-edge", async () => {
        db.insertVertex({ id: "1" });
        db.insertVertex({ id: "2" });
        db.insertEdge({ source: "1", target: "2", id: "12abc", props: { fact: "abc" } });
        const result1 = db.getVertexById("1");
        expect(result1).toEqual({ id: "1", name: null, ns: null, props: null, type: "vertex" })
        const result2 = db.getVertexById("2");
        expect(result2).toEqual({ id: "2", name: null, ns: null, props: null, type: "vertex" })

        // from-to
        const edgeFT = db.getEdges("1", "2");
        expect([...edgeFT]).toEqual([{ source: "1", target: "2", id: "12abc", name: null, inverseName: null, ns: null, props: { fact: "abc" }, type: "edge" }]);

        // to-from
        const edgeTF = db.getEdges("2", "1", "toFrom");
        expect([...edgeTF]).toEqual([{ source: "1", target: "2", id: "12abc", name: null, inverseName: null, ns: null, props: { fact: "abc" }, type: "edge" }]);

        // both
        const edgeXX = db.getEdges("2", "1", "both");
        expect([...edgeXX]).toEqual([{ source: "1", target: "2", id: "12abc", name: null, inverseName: null, ns: null, props: { fact: "abc" }, type: "edge" }]);

        const edge = db.getEdgeById("12abc")!
        expect(edge.id).toBeDefined()
        db.deleteEdge(<string>edge.id);
        const noEdge = db.getEdgeById(<string>edge.id);
        expect(noEdge).toBeUndefined();
    })

    test("searchVertices", () => {
        db.insertVertex({ id: "a", props: { field: "value" } })
        const nodes = [...db.searchVertices({ field: { eq: "value" } })]
        expect(nodes).toStrictEqual([{ id: "a", name: null, ns: null, props: { field: "value" }, type: "vertex" }])
    })

    test("searchEdges", () => {
        db.insertVertex({ id: "a", props: { field: "value" } })
        db.insertVertex({ id: "b", props: { field: "value" } })
        db.insertEdge({ source: "a", target: "b", props: { meta: "data" } })
        const edges = [...db.searchEdges({ meta: { eq: "data" } })]
        expect(edges).toStrictEqual([{
            id: "a:b",
            name: null,
            inverseName: null,
            ns: null,
            source: "a",
            target: "b",
            props: {
                meta: "data"
            },
            type: "edge"
        }])
    })

    test("insert-node & update-node", async () => {
        db.insertVertex({
            id: "a",
            props: { a: 0 }
        })
        expect(db.getVertexById("a")).toEqual({ id: "a", name: null, ns: null, type: "vertex", props: { a: 0 } })
        db.updateVertex({
            id: "a",
            props: { b: 1 }
        })
        expect(db.getVertexById("a")).toEqual({ id: "a", name: null, ns: null, type: "vertex", props: { b: 1 } })
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
        db.insertVertex({ id: "a" })
        db.insertVertex({ id: "b" })
        db.insertVertex({ id: "c" })
        db.insertVertex({ id: "d" })
        db.insertVertex({ id: "e" })
        db.insertEdge({ source: "a", target: "b" })
        db.insertEdge({ source: "b", target: "c" })
        db.insertEdge({ source: "c", target: "d" })
        db.insertEdge({ source: "d", target: "e" })

        expect([...db.traverse("a")]).toStrictEqual([
            { id: "a", kind: "vertex" },
            { id: "a:b", kind: "targets" },
            { id: "b", kind: "vertex" },
            { id: "a:b", kind: "sources" },
            { id: "b:c", kind: "targets" },
            { id: "c", kind: "vertex" },
            { id: "b:c", kind: "sources" },
            { id: "c:d", kind: "targets" },
            { id: "d", kind: "vertex" },
            { id: "c:d", kind: "sources" },
            { id: "d:e", kind: "targets" },
            { id: "e", kind: "vertex" },
            { id: "d:e", kind: "sources" },
        ])
    })

    test("traverseWithProps", () => {
        db.insertVertex({ id: "a", props: { thisId: "a" } })
        db.insertVertex({ id: "b", props: { thisId: "b" } })
        db.insertVertex({ id: "c", props: { thisId: "c" } })
        db.insertVertex({ id: "d", props: { thisId: "d" } })
        db.insertVertex({ id: "e", props: { thisId: "e" } })
        db.insertEdge({ source: "a", target: "b", props: { thisEdgeSource: "a" } })
        db.insertEdge({ source: "b", target: "c", props: { thisEdgeSource: "b" } })
        db.insertEdge({ source: "c", target: "d", props: { thisEdgeSource: "c" } })
        db.insertEdge({ source: "d", target: "e", props: { thisEdgeSource: "d" } })

        expect([...db.traverseWithProps("a")]).toStrictEqual([
            { id: "a", kind: "vertex", props: { thisId: "a" } },
            { id: "a:b", kind: "targets", source: "a", target: "b", props: { thisEdgeSource: "a" } },
            { id: "b", kind: "vertex", props: { thisId: "b" } },
            { id: "a:b", kind: "sources", source: "a", target: "b", props: { thisEdgeSource: "a" } },
            { id: "b:c", kind: "targets", source: "b", target: "c", props: { thisEdgeSource: "b" } },
            { id: "c", kind: "vertex", props: { thisId: "c" } },
            { id: "b:c", kind: "sources", source: "b", target: "c", props: { thisEdgeSource: "b" } },
            { id: "c:d", kind: "targets", source: "c", target: "d", props: { thisEdgeSource: "c" } },
            { id: "d", kind: "vertex", props: { thisId: "d" } },
            { id: "c:d", kind: "sources", source: "c", target: "d", props: { thisEdgeSource: "c" } },
            { id: "d:e", kind: "targets", source: "d", target: "e", props: { thisEdgeSource: "d" } },
            { id: "e", kind: "vertex", props: { thisId: "e" } },
            { id: "d:e", kind: "sources", source: "d", target: "e", props: { thisEdgeSource: "d" } },
        ])

        expect([...db.traverseWithProps("a", "targets")]).toStrictEqual([
            { id: "a", kind: "vertex", props: { thisId: "a" } },
            { id: "a:b", kind: "targets", source: "a", target: "b", props: { thisEdgeSource: "a" } },
            { id: "b", kind: "vertex", props: { thisId: "b" } },
            { id: "b:c", kind: "targets", source: "b", target: "c", props: { thisEdgeSource: "b" } },
            { id: "c", kind: "vertex", props: { thisId: "c" } },
            { id: "c:d", kind: "targets", source: "c", target: "d", props: { thisEdgeSource: "c" } },
            { id: "d", kind: "vertex", props: { thisId: "d" } },
            { id: "d:e", kind: "targets", source: "d", target: "e", props: { thisEdgeSource: "d" } },
            { id: "e", kind: "vertex", props: { thisId: "e" } },
        ])
    })

    afterEach(() => {
        db.close();
    })
})