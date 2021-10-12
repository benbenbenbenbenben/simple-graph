import init, { BindParams, ParamsObject, SqlValue } from "sql.js";
const sqlite = init();

export const linetrim = (strings: TemplateStringsArray, ...expr: string[]): string => {
    return strings.slice(1).reduce((str, fragment, i) => str + expr[i] + fragment, strings[0]).replace(/^.*(\r\n|\r|\n)$/gm, line => line.trim() + `\n`)
}

export const ltrbtrim = (strings: TemplateStringsArray, ...expr: string[]): string => {
    return strings.slice(1).reduce((str, fragment, i) => str + expr[i] + fragment, strings[0]).replace(/^.*$/gm, line => line.trim() + `\n`).replace(/^(\r|\n|\r\n)/g, "")
}

const DefaultSchema = linetrim`
    CREATE TABLE IF NOT EXISTS vertices (
        id      TEXT NOT NULL UNIQUE,
        name    TEXT,
        ns      TEXT,
        props   TEXT
    );

    CREATE INDEX IF NOT EXISTS id_idx ON vertices(id);
    CREATE INDEX IF NOT EXISTS id_idx ON vertices(name);
    CREATE INDEX IF NOT EXISTS id_idx ON vertices(ns);

    CREATE TABLE IF NOT EXISTS edges (
        id          TEXT NOT NULL UNIQUE,
        name        TEXT,
        inverseName TEXT,
        ns          TEXT,
        source      TEXT,
        target      TEXT,
        props       TEXT,
        FOREIGN KEY(source) REFERENCES vertices(id),
        FOREIGN KEY(target) REFERENCES vertices(id)
    );

    CREATE INDEX IF NOT EXISTS id_idx ON edges(id);
    CREATE INDEX IF NOT EXISTS name_idx ON edges(name);
    CREATE INDEX IF NOT EXISTS inverseName_idx ON edges(inverseName);
    CREATE INDEX IF NOT EXISTS ns_idx ON edges(ns);
    CREATE INDEX IF NOT EXISTS source_idx ON edges(source);
    CREATE INDEX IF NOT EXISTS target_idx ON edges(target);
`
export type Extendable<Obj> = Record<string, unknown> & Obj

export type PropType = number | string | boolean | { [x: string]: PropType }
export type Props = {
    [x: string]: PropType | PropType[]
}

export type VertexModel<
    Name extends string = string,
    Namespace extends string = string,
    KnownProps extends Props | undefined = any,
    > = {
        type: "vertex"
        id: string
        name?: Name
        ns?: Namespace
        props?: Extendable<KnownProps extends undefined ? (Props | undefined) : KnownProps>
    }
export type EdgeModel<
    Name extends string = string,
    Namespace extends string = string,
    InverseName extends string = `inverse(${Name})`,
    KnownProps extends Props | undefined = any,
    > = {
        type: "edge"
        id?: string
        source: string
        target: string
        name?: Name
        inverseName?: InverseName
        ns?: Namespace
        props?: Extendable<KnownProps extends undefined ? (Props | undefined) : KnownProps>
    }

export type RequiredOmitted<T, R extends keyof T, O extends PropertyKey> =
    Partial<Omit<T, O>> & Pick<T, R>

export const createDb = async (schema = DefaultSchema) => {
    const database = new (await sqlite).Database();
    database.run(schema);
    return {
        insertMany: (...vertexOrEdge: (RequiredOmitted<VertexModel, "id" | "type", never> | RequiredOmitted<EdgeModel, "source" | "target" | "type", never>)[]) => {
            const vertices = vertexOrEdge.filter(t => t.type === "vertex") as VertexModel[]
            const edges = vertexOrEdge.filter(t => t.type === "edge") as EdgeModel[]

            const verticesInsertStatement = vertices.length === 0 ? ''
                : linetrim`${vertices.map((v, i) => `INSERT INTO vertices VALUES(:p${i * 4}, :p${i * 4 + 1}, :p${i * 4 + 2}, json(:p${i * 4 + 3}))`).join(";\n")};`
            const edgesInsertStatement = edges.length === 0 ? ''
                : linetrim`${edges.map((e, i) => `INSERT INTO edges VALUES(:p${(vertices.length * 4) + i * 7}, :p${(vertices.length * 4) + i * 7 + 1}, :p${(vertices.length * 4) + i * 7 + 2}, :p${(vertices.length * 4) + i * 7 + 3}, :p${(vertices.length * 4) + i * 7 + 4}, :p${(vertices.length * 4) + i * 7 + 5}, json(:p${(vertices.length * 4) + i * 7 + 6}))`).join(", ")}
            `;
            linetrim`${verticesInsertStatement}
            ${edgesInsertStatement}` // ?
            // const values = [...vertices.flatMap(v => (
            //     [v.id, v.name || null, v.ns || null, v.props ? JSON.stringify(v.props) : null]
            // )), ...edges.flatMap(e => (
            //     [e.id || null, e.name || null, e.inverseName || null, e.ns || null, e.source, e.target, e.props ? JSON.stringify(e.props) : null]
            // ))].reduce((a, p, i) => ({ ...a, [`p${i}`]: p }), <ParamsObject>{})
            // values // ?

            const values = [...vertices.flatMap(v => (
                [v.id, v.name || null, v.ns || null, v.props ? JSON.stringify(v.props) : null]
            )), ...edges.flatMap(e => (
                [e.id || null, e.name || null, e.inverseName || null, e.ns || null, e.source, e.target, e.props ? JSON.stringify(e.props) : null]
            ))]
            values // ?


            database.exec(linetrim`
                BEGIN;
                ${verticesInsertStatement}
                ${edgesInsertStatement}
                COMMIT;
            `, ...values)
        },
        insertVertex: <T extends RequiredOmitted<VertexModel, "id", "type">>(node: T) => {
            database.run(`INSERT INTO vertices VALUES(?, ?, ?, json(?))`, [
                node.id,
                node.name ?? null,
                node.ns ?? null,
                node.props ? JSON.stringify(node.props) : null
            ]);
        },
        updateVertex: <T extends RequiredOmitted<VertexModel, "id", "type">>(node: T) => {
            database.run(ltrbtrim`
                UPDATE vertices
                SET name = ?,
                    ns = ?,
                    props = json(?)
                WHERE id = ?
            `, [
                node.name ?? null,
                node.ns ?? null,
                node.props ? JSON.stringify(node.props) : null,
                node.id
            ])
        },
        deleteVertex: (id: string) => {
            database.run(`DELETE FROM vertices WHERE id = ?`, [id]);
        },
        getVertexById: <T extends VertexModel>(id: string): T | undefined => {
            const stmt = database.prepare(`SELECT * FROM vertices WHERE id = ?`, [id]);
            if (stmt.step()) {
                return {
                    ...stmt.getAsObject(),
                    props: JSON.parse((stmt.getAsObject().props || "null").toString()),
                    type: "vertex"
                } as T;
            } else {
                return undefined;
            }
        },
        insertEdge: <T extends RequiredOmitted<EdgeModel, "source" | "target", "type">>(edge: T) => {
            database.run(ltrbtrim`
                INSERT INTO edges VALUES(
                    ?, ?, ?, ?, ?, ?, json(?)
                )
            `, [
                edge.id ?? `${edge.source}:${edge.target}`,
                edge.name ?? null,
                edge.inverseName ?? (edge.name ? `inverse(${edge.name})` : null),
                edge.ns ?? null,
                edge.source,
                edge.target,
                edge.props ? JSON.stringify(edge.props) : null,
            ]);
        },
        deleteEdge: (id: string) => {
            database.run(`DELETE FROM edges WHERE id = ?`, [id])
        },
        getEdgeById: <T extends EdgeModel>(id: string): T | undefined => {
            const stmt = database.prepare(`SELECT * FROM edges WHERE id = ?`, [id]);
            if (stmt.step()) {
                return {
                    ...stmt.getAsObject(),
                    props: JSON.parse((stmt.getAsObject().props || "null").toString()),
                    type: "edge"
                } as T;
            } else {
                return undefined;
            }
        },
        getEdges: function* <T extends EdgeModel>(fromId: string, toId: string, direction: "fromTo" | "toFrom" | "both" = "fromTo"): IterableIterator<T> {
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
                yield {
                    ...stmt.getAsObject(),
                    props: JSON.parse((stmt.getAsObject().props || "null").toString()),
                    type: "edge"
                } as T;
            }
        },
        searchVertices: function* <T extends VertexModel>(query: WhereClause<Partial<T["props"]>>, finalClause?: { OFFSET: number, LIMIT: number }) {
            const where = whereClauseToSql(query, "props");
            // TODO: this would be better as object params as opposed to array
            const finalClauseSql = finalClause ? `LIMIT ${finalClause.LIMIT + 0} OFFSET ${finalClause.OFFSET + 0}` : ``;
            const stmt = database.prepare(`SELECT * FROM vertices WHERE ${where.sql} ${finalClauseSql}`, where.params)
            while (stmt.step()) {
                yield {
                    ...stmt.getAsObject(),
                    props: JSON.parse((stmt.getAsObject().props || "null").toString()),
                    type: "vertex"
                } as T;
            }
        },
        searchEdges: function* <T extends EdgeModel>(query: WhereClause<Partial<T["props"]>>) {
            const where = whereClauseToSql(query, "props");
            const stmt = database.prepare(`SELECT * FROM edges WHERE ${where.sql}`, where.params)
            while (stmt.step()) {
                yield {
                    ...stmt.getAsObject(),
                    props: JSON.parse((stmt.getAsObject().props || "null").toString()),
                    type: "edge"
                } as T;
            }
        },
        traverse: function* (vertexId: string, direction: "both" | "sources" | "targets" = "both"): IterableIterator<{
            id: string,
            kind: "vertex" | "sources" | "targets"
        }> {
            const sql = `
                WITH RECURSIVE traverse(x, z, y) AS (
                SELECT :0, '', '()'
                UNION
                SELECT id, null, 'vertex' FROM vertices JOIN traverse ON id = x
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
            const stmt = database.prepare(sql, [vertexId]);
            while (stmt.step()) {
                yield stmt.getAsObject() as {
                    id: string,
                    kind: "vertex" | "sources" | "targets"
                }
            }
        },
        traverseWithProps: function* <NodeTypes = unknown, SourceTypes = unknown, TargetTypes = unknown>(vertexId: string, direction: "both" | "sources" | "targets" = "both"): IterableIterator<
            { id: string } & (
                { kind: "vertex", vertex: NodeTypes } | { kind: "sources", sources: SourceTypes } | { kind: "targets", targets: TargetTypes }
            )
        > {
            const sql = `
                WITH RECURSIVE traverse(x, z, y, s, t, obj) AS (
                SELECT :0, '', '()', 's', 't', '{}'
                UNION
                SELECT id, null, 'vertex', null, null, props FROM vertices JOIN traverse ON id = x
                ${direction !== "targets" ? `
                    UNION
                    SELECT source, id as eid, 'sources', source, target, props FROM edges JOIN traverse ON target = x
                ` : ``}
                ${direction !== "sources" ? `
                    UNION
                    SELECT target, id as eid, 'targets', source, target, props FROM edges JOIN traverse ON source = x
                ` : ``}
              ) SELECT coalesce(z, x) as id, y as kind, s, t, obj FROM traverse LIMIT -1 OFFSET 1;
            `
            const stmt = database.prepare(sql, [vertexId]);
            while (stmt.step()) {
                stmt.getAsObject() // ?
                const result = stmt.getAsObject() as { kind: "vertex" | "sources" | "targets", id: string, obj: string, s: string, t: string }
                yield {
                    id: result.id,
                    kind: result.kind,
                    ...(result.kind !== "vertex" ? {
                        source: result.s,
                        target: result.t,
                    } : {}),
                    props: JSON.parse(result.obj),
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
