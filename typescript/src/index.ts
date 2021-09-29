import { readFileSync } from "fs";
import init, { Database } from "sql.js";
const sqlite = init();

const loadSql = (filename: string) => {
    return readFileSync(`../sql/${filename}`).toString();
}

export const createDb = async (schemaFile = "schema-new.sql") => {
    const database = new (await sqlite).Database();
    database.exec(loadSql(schemaFile));
    return {
        insertNode: <T extends { id: string }>(node: T) => {
            database.run(loadSql("insert-node.sql"), [JSON.stringify(node)]);
        },
        deleteNode: (id: string) => {
            database.run(loadSql("delete-node.sql"), [id]);
        },
        searchNodeById: <T extends { id: string }>(id: string) => {
            const stmt = database.prepare(loadSql("search-node-by-id.sql"), [id]);
            if (stmt.step()) {
                return JSON.parse(stmt.getAsObject().body!.toString()) as T;
            } else {
                return undefined;
            }
        },
        insertEdge: <T extends { id: string }>(fromId: string, toId: string, properties: T = <T>{ id: `${fromId}:${toId}` }) => {
            database.run(loadSql("insert-edge.sql"), [fromId, toId, JSON.stringify(properties)]);
        },
        deleteEdge: (id: string) => {
            database.run("DELETE FROM edges WHERE id = ?", [id])
        },
        searchEdgeById: <T extends { id: string }>(id: string): { id: string, source: string, target: string, properties: T } | undefined => {
            const stmt = database.prepare("SELECT * FROM edges wHERE id = ?", [id]);
            if (stmt.step()) {
                return stmt.getAsObject() as any as { id: string, source: string, target: string, properties: T & { id: string } }
            } else {
                return undefined;
            }
        },
        searchEdges: function* <T = any>(fromId: string, toId: string, direction: "fromTo" | "toFrom" | "both" = "fromTo"): IterableIterator<{
            id: string,
            source: string,
            target: string,
            properties: T
        }> {
            if (direction === "both") {
                yield* this.searchEdges(toId, fromId);
                direction = "fromTo";
            }
            const stmt = database.prepare(loadSql("search-edges.sql"), direction === "fromTo" ? [fromId, toId] : [toId, fromId]);
            while (stmt.step()) {
                const edge = stmt.getAsObject() as any as { id: string, source: string, target: string, properties: string };
                yield {
                    ...edge,
                    properties: JSON.parse(edge.properties) as (T & { id: string })
                };
            }
        },
        raw: (sql: string) => {
            return database.exec(sql);
        },
        close: () => {
            database.close();
        }
    }
}