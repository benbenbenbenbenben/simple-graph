import { readFileSync } from "fs";
import init, { Database } from "sql.js";
const sqlite = init();

const loadSql = (filename: string) => {
    return readFileSync(`../sql/${filename}`).toString();
}

export const createDb = async (schemaFile = "schema.sql") => {
    const database = new (await sqlite).Database();
    database.exec(loadSql(schemaFile));
    return {
        insertNode: async <T extends { id: string }>(node: T) => {
            database.run(loadSql("insert-node.sql"), [JSON.stringify(node)]);
        },
        searchNodeById: async <T extends { id: string }>(id: string) => {
            const stmt = database.prepare(loadSql("search-node-by-id.sql"), [id]);
            if (stmt.step()) {
                return JSON.parse(stmt.getAsObject().body!.toString()) as T;
            } else {
                return undefined;
            }
        },
        insertEdge: (fromId: string, toId: string) => {
            database.run(loadSql("insert-edge.sql"), [fromId, toId]);
        },
        raw: async (sql: string) => {
            return database.exec(sql);
        },
        close: () => {
            database.close();
        }
    }
}