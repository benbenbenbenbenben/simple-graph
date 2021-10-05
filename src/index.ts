import init, { ParamsObject, SqlValue } from "sql.js";
const sqlite = init();

export const linetrim = (strings: TemplateStringsArray, ...expr: string[]): string => {
    return strings.slice(1).reduce((str, fragment, i) => str + expr[i] + fragment, strings[0]).replace(/^.*$/gm, line => line.trim() + `\n`)
}

const DefaultSchema = linetrim`
    CREATE TABLE IF NOT EXISTS vertices (
        body TEXT,
        id   TEXT GENERATED ALWAYS AS (json_extract(body, '$.id')) VIRTUAL NOT NULL UNIQUE
    );

    CREATE INDEX IF NOT EXISTS id_idx ON vertices(id);

    CREATE TABLE IF NOT EXISTS edges (
        properties TEXT,
        source     TEXT GENERATED ALWAYS AS (json_extract(properties, '$.source')) VIRTUAL NOT NULL,
        target     TEXT GENERATED ALWAYS AS (json_extract(properties, '$.target')) VIRTUAL NOT NULL,
        id         TEXT GENERATED ALWAYS AS (coalesce(json_extract(properties, '$.id'), source || ':' || target)) VIRTUAL NOT NULL UNIQUE,
        FOREIGN KEY(source) REFERENCES vertices(id),
        FOREIGN KEY(target) REFERENCES vertices(id)
    );

    CREATE INDEX IF NOT EXISTS id_idx ON edges(id);
    CREATE INDEX IF NOT EXISTS source_idx ON edges(source);
    CREATE INDEX IF NOT EXISTS target_idx ON edges(target);
`

export const createDb = async (schema = DefaultSchema) => {
    const database = new (await sqlite).Database();
    database.exec(schema);
    return {
        insertNode: <T extends { id: string }>(node: T) => {
            database.run(`INSERT INTO vertices VALUES(json(?))`, [JSON.stringify(node)]);
        },
        updateNode: <T extends { id: string }>(node: T) => {
            database.run(`UPDATE vertices SET body = json(?) WHERE id = ?`, [JSON.stringify(node), node.id])
        },
        deleteNode: (id: string) => {
            database.run(`DELETE FROM vertices WHERE id = ?`, [id]);
        },
        getNodeById: <T extends { id: string }>(id: string) => {
            const stmt = database.prepare(`SELECT body FROM vertices WHERE id = ?`, [id]);
            if (stmt.step()) {
                return JSON.parse(stmt.getAsObject().body!.toString()) as T;
            } else {
                return undefined;
            }
        },
        insertEdge: <T extends { source: string, target: string, id?: string }>(edge: T) => {
            database.run(`INSERT INTO edges VALUES(json(?))`, [JSON.stringify({ id: `${edge.source}:${edge.target}`, ...edge })]);
        },
        deleteEdge: (id: string) => {
            database.run(`DELETE FROM edges WHERE id = ?`, [id])
        },
        getEdgeById: <T extends { id: string, source: string, target: string }>(id: string): T | undefined => {
            const stmt = database.prepare(`SELECT * FROM edges wHERE id = ?`, [id]);
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
            const stmt = database.prepare(linetrim`
                SELECT * FROM edges WHERE source = ? 
                UNION
                SELECT * FROM edges WHERE target = ?
            `, direction === "fromTo" ? [fromId, toId] : [toId, fromId]);
            while (stmt.step()) {
                const edge = stmt.getAsObject() as any as { id: string, source: string, target: string, properties: string };
                yield JSON.parse(edge.properties) as T;
            }
        },
        searchVertices: function* <T>(query: WhereClause<Partial<T>>, finalClause?: { OFFSET: number, LIMIT: number }) {
            const where = whereClauseToSql(query, "body");
            // TODO: this would be better as object params as opposed to array
            const finalClauseSql = finalClause ? `LIMIT ${finalClause.LIMIT + 0} OFFSET ${finalClause.OFFSET + 0}` : ``;
            const stmt = database.prepare(`SELECT * FROM vertices WHERE ${where.sql} ${finalClauseSql}`, where.params)
            while (stmt.step()) {
                yield JSON.parse(stmt.getAsObject().body!.toString()) as T;
            }
        },
        searchEdges: function* <T>(query: WhereClause<Partial<T>>) {
            const where = whereClauseToSql(query, "properties");
            const stmt = database.prepare(`SELECT * FROM edges WHERE ${where.sql}`, where.params)
            while (stmt.step()) {
                yield JSON.parse(stmt.getAsObject().properties!.toString()) as T;
            }
        },
        traverse: function* (nodeId: string, direction: "both" | "sources" | "targets" = "both"): IterableIterator<{
            id: string,
            kind: "node" | "sources" | "targets"
        }> {
            const sql = `
                WITH RECURSIVE traverse(x, z, y) AS (
                SELECT :0, '', '()'
                UNION
                SELECT id, null, 'node' FROM vertices JOIN traverse ON id = x
                ${direction !== "targets" ? `
                    UNION
                    SELECT source, id as eid, 'sources' FROM edges JOIN traverse ON target = x
                ` : ``}
                ${direction !== "sources" ? `
                    UNION
                    SELECT target, id as eid, 'targets' FROM edges JOIN traverse ON source = x
                ` : ``}
              ) SELECT coalesce(z, x) as id, y as kind FROM traverse LIMIT -1 OFFSET 1;
            `
            const stmt = database.prepare(sql, [nodeId]);
            while (stmt.step()) {
                yield stmt.getAsObject() as {
                    id: string,
                    kind: "node" | "sources" | "targets"
                }
            }
        },
        traverseWithBody: function* <NodeTypes = unknown, SourceTypes = unknown, TargetTypes = unknown>(nodeId: string, direction: "both" | "sources" | "targets" = "both"): IterableIterator<
            { id: string } & (
                { kind: "node", node: NodeTypes } | { kind: "sources", sources: SourceTypes } | { kind: "targets", targets: TargetTypes }
            )
        > {
            const sql = `
                WITH RECURSIVE traverse(x, z, y, obj) AS (
                SELECT :0, '', '()', '{}'
                UNION
                SELECT id, null, 'node', body FROM vertices JOIN traverse ON id = x
                ${direction !== "targets" ? `
                    UNION
                    SELECT source, id as eid, 'sources', properties FROM edges JOIN traverse ON target = x
                ` : ``}
                ${direction !== "sources" ? `
                    UNION
                    SELECT target, id as eid, 'targets', properties FROM edges JOIN traverse ON source = x
                ` : ``}
              ) SELECT coalesce(z, x) as id, y as kind, obj FROM traverse LIMIT -1 OFFSET 1;
            `
            const stmt = database.prepare(sql, [nodeId]);
            while (stmt.step()) {
                const result = stmt.getAsObject() as { kind: "node" | "sources" | "targets", id: string, obj: string }
                yield {
                    id: result.id,
                    kind: result.kind,
                    [result.kind]: JSON.parse(result.obj),
                } as unknown as any
            }
        },
        raw: (sql: string, ...parameters: SqlValue[]): any[][] => {
            const paramsObject: ParamsObject = parameters.reduce((o, value, i) => {
                return { ...o, [`:${i}`]: value }
            }, {})
            return database.exec(sql, paramsObject).map(result => {
                return result.values.map(rows => rows.reduce((obj, col, i) => ({ ...obj, [result.columns[i]]: col }), {}))
            })
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
    [K in keyof T]?: WhereClauseOperation<T[K]>
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
