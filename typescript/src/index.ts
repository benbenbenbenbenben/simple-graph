import { readFileSync } from "fs";
import init, { BindParams, Database, SqlValue } from "sql.js";
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
        updateNode: <T extends { id: string }>(node: T) => {
            database.run(loadSql("update-node.sql"), [JSON.stringify(node), node.id])
        },
        deleteNode: (id: string) => {
            database.run(loadSql("delete-node.sql"), [id]);
        },
        getNodeById: <T extends { id: string }>(id: string) => {
            const stmt = database.prepare(loadSql("search-node-by-id.sql"), [id]);
            if (stmt.step()) {
                return JSON.parse(stmt.getAsObject().body!.toString()) as T;
            } else {
                return undefined;
            }
        },
        insertEdge: <T extends { source: string, target: string, id?: string }>(edge: T) => {
            database.run("INSERT INTO edges VALUES(json(?))", [JSON.stringify({ id: `${edge.source}:${edge.target}`, ...edge })]);
        },
        deleteEdge: (id: string) => {
            database.run("DELETE FROM edges WHERE id = ?", [id])
        },
        getEdgeById: <T extends { id: string, source: string, target: string }>(id: string): T | undefined => {
            const stmt = database.prepare("SELECT * FROM edges wHERE id = ?", [id]);
            if (stmt.step()) {
                return JSON.parse(stmt.getAsObject().properties!.toString()) as T;
            } else {
                return undefined;
            }
        },
        getEdges: function* <T extends { id: string, source: string, target: string }>(fromId: string, toId: string, direction: "fromTo" | "toFrom" | "both" = "fromTo"): IterableIterator<T> {
            if (direction === "both") {
                yield* this.getEdges(toId, fromId);
                direction = "fromTo";
            }
            const stmt = database.prepare(loadSql("search-edges.sql"), direction === "fromTo" ? [fromId, toId] : [toId, fromId]);
            while (stmt.step()) {
                const edge = stmt.getAsObject() as any as { id: string, source: string, target: string, properties: string };
                yield JSON.parse(edge.properties) as T;
            }
        },
        // TODO: query builder
        searchNodes: function* <T>(query: WhereClause<Partial<T>>) {
            const where = whereClauseToSql(query, "body");
            const stmt = database.prepare(`SELECT * FROM nodes WHERE ${where.sql}`, where.params)
            while (stmt.step()) {
                yield JSON.parse(stmt.getAsObject().body!.toString()) as T;
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

export type WhereClauseOperation<FieldType> =
    FieldType extends string ?
    ({
        eq: FieldType
    } | {
        like: FieldType
    } | {
        startsWith: FieldType
    } | {
        endsWith: FieldType
    }) : {
        eq: FieldType
    }

export type WhereClause<T> = {
    [K in keyof T]: WhereClauseOperation<T[K]>
} & {
    AND?: WhereClause<T>
} & {
    OR?: WhereClause<T>
}

export const whereClauseToSql = <T>(query: WhereClause<Partial<T>>, jsonField?: string): {
    sql: string,
    params: SqlValue[]
} => {
    const result = Object.entries(query).reduce(({ sql, params }, [name, field], i) => {
        if (["AND", "OR"].includes(name)) {
            const intermediate = whereClauseToSql(field, jsonField);
            return {
                sql: `${sql} ${name} (${intermediate.sql.replace(/\d+/g, ss => (parseInt(ss) + params.length).toString())})`,
                params: [...params, ...intermediate.params]
            }
        }
        const stringOperators: Record<string, (value: string, index: number) => string> = {
            eq: (value, index) => `= :${index}`,
            like: (value, index) => `like '%${index}%'`,
            startsWith: (value, index) => `like '${index}%'`,
            endsWith: (value, index) => `like '%${index}'`,
        }
        const operators = {
            "string": stringOperators
        }
        const [op, rhs] = Object.entries(field)[0]
        return {
            sql: `${sql}${/:\d+$/.test(sql) ? " AND" : ""} ${jsonField ? `json_extract(${jsonField}, '$.${name}')` : name} ${operators["string"][op](op, params.length)}`,
            params: [
                ...params, rhs
            ]
        }
    }, { sql: "", params: [] as any[] })
    return {
        sql: result.sql.trim(),
        params: result.params
    };
}