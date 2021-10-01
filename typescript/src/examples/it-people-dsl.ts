import { DateTime } from "luxon"
import { linetrim, createDb, WhereClause } from "../index"

// Base DSL

type VertexFindOrCreate<VertexType extends string, Edges> = {
    vertex: NodeLike<VertexType>
} & {
        [key in keyof Edges]: Edges[key]
    }

type NodeLike<T extends string> = { id: string, type: T }
type CursorForVertex = <VertexType extends string>(node: NodeLike<VertexType>) => <Edges>(edges: Edges) => VertexFindOrCreate<VertexType, Edges>

type EdgeLike<T extends string> = { source: string, target: string, type: T }
type CursorForEdgeSourceToTarget = <EdgeType extends string>(edge: EdgeLike<EdgeType>) => <TargetVertexCursor>(vertexTargets: TargetVertexCursor) => TargetVertexCursor


// IT People DSL

const company = {
    create: (
        cursorForVertex: CursorForVertex,
        cursorForEdgeSourceToTarget: CursorForEdgeSourceToTarget
    ) => (
        name: string
    ) => cursorForVertex<"company">({
        id: `company/${name}`, type: "company"
    })({

    })
}
const skill = {
    create: (
        cursorForVertex: CursorForVertex,
        cursorForEdgeSourceToTarget: CursorForEdgeSourceToTarget
    ) => (
        name: string
    ) => cursorForVertex<"skill">({
        id: `skill/${name}`, type: "skill"
    })({

    })
}
const person = {
    create: (
        cursorForVertex: CursorForVertex,
        cursorForEdgeSourceToTarget: CursorForEdgeSourceToTarget
    ) => (
        name: string
    ) => cursorForVertex<"person">({
        id: `person/${name}`, type: "person"
    })({
        /* contextual edges */
        that: {
            worksAt: (
                _company: ReturnType<ReturnType<typeof company.create>>,
                properties: {
                    beginning: DateTime,
                    ending?: DateTime,
                    fulltime?: boolean,
                }) => cursorForEdgeSourceToTarget<"worksAt">({
                    type: "worksAt", ...properties,
                    source: `person/${name}`,
                    target: _company.vertex.id
                })({
                    as: (
                        _job: ReturnType<ReturnType<typeof job.create>>,
                        properties: {
                            //                         
                        }) => {
                        // TODO: what do we do here?
                        return _job
                    }
                }),
            usesTheSkill: (
                _skill: ReturnType<ReturnType<typeof skill.create>>
            ) => cursorForEdgeSourceToTarget<"usesTheSkill">({
                type: "usesTheSkill",
                source: `person/${name}`,
                target: _skill.vertex.id
            })({
                at: (
                    _company: ReturnType<ReturnType<typeof company.create>>
                ) => {
                    // TODO: what do we do here?
                    return _company
                }
            })
        }
    })
}
const job = {
    create: (
        cursorForVertex: CursorForVertex,
        cursorForEdgeSourceToTarget: CursorForEdgeSourceToTarget
    ) => (
        name: string
    ) => cursorForVertex<"job">({ id: `job/${name}`, type: "job" })({
        that: {
            mayRequireTheSkill: (_skill: ReturnType<ReturnType<typeof skill.create>>) => {
                return _skill
            }
        }
    })
}

type createBuilder = {
    company: ReturnType<typeof company.create>,
    skill: ReturnType<typeof skill.create>,
    person: ReturnType<typeof person.create>,
    job: ReturnType<typeof job.create>,
    // TODO: could these be keyed?
    dump: () => ({ node: NodeLike<string> } | { edge: EdgeLike<string> })[]
}

const before = <Func extends (...args: any[]) => any>(
    beforeFunc: (...input: Parameters<Func>) => Parameters<Func> | void
) => (func: Func) => (...input: Parameters<Func>): ReturnType<Func> =>
    func(beforeFunc(...input) || input)
const after = <Func extends (...args: any[]) => any>(
    afterFunc: (result: ReturnType<Func>) => ReturnType<Func> | void
) => (func: Func) => (...input: Parameters<Func>): ReturnType<Func> => {
    const result = func(input)
    return afterFunc(result) || result
}


export const itPeopleDsl = (database: ReturnType<typeof createDb>) => {

    return {
        create: async <OptionalOutput>(query: ($: createBuilder) => OptionalOutput) => {
            const updates: ({ node: NodeLike<string> } | { edge: EdgeLike<string> })[] = []
            const cursorForVertex = <VertexType extends string>(node: NodeLike<VertexType>) => <Edges>(edges: Edges): VertexFindOrCreate<VertexType, Edges> => {
                updates.push({ node })
                return {
                    vertex: node,
                    ...edges
                }
            }
            const cursorForEdgeSourceToTarget = <EdgeType extends string>(edge: EdgeLike<EdgeType>) => <TargetVertexCursor>(vertexTargets: TargetVertexCursor) => {
                updates.push({ edge })
                return {
                    ...vertexTargets
                }
            }
            const createOutput = query({
                company: company.create(cursorForVertex, cursorForEdgeSourceToTarget),
                skill: skill.create(cursorForVertex, cursorForEdgeSourceToTarget),
                person: person.create(cursorForVertex, cursorForEdgeSourceToTarget),
                job: job.create(cursorForVertex, cursorForEdgeSourceToTarget),
                dump: () => [...updates]
            })
            // TODO: convert updates to query and execute (behind an await)
            const nodes = (<any[]>updates).map(({ node }) => node as NodeLike<string>).filter(x => x)
            const edges = (<any[]>updates).map(({ edge }) => edge as EdgeLike<string>).filter(x => x)
            const sql = linetrim`
                BEGIN TRANSACTION;
                
                INSERT INTO nodes VALUES ${nodes.map((_, i) => `(:${i})`).join(", ")};
                INSERT INTO edges VALUES ${edges.map((_, i) => `(:${nodes.length + i})`).join(", ")};

                COMMIT TRANSACTION;
                SELECT 1 as ok;
            `
            return {
                preview: () => sql,
                execute: async () => {
                    const db = await database
                    const result = db.raw(sql, ...[...nodes, ...edges].map(node => JSON.stringify(node)))
                    return result[0][0].ok === 1
                },
                createOutput
            };
        },

        find: findQueryBuilder(database, (_one, _many) => ({
            person: () => ({
                one: async (idOrQuery?: string | WhereClause<ReturnType<ReturnType<typeof person.create>>["vertex"]>) => {
                    if (idOrQuery) {
                        return _one(typeof idOrQuery === "string" ? { id: { eq: `person/${idOrQuery}` } } : idOrQuery) as any as ReturnType<ReturnType<typeof person.create>>["vertex"]
                    } else {
                        return _one({ type: { eq: "person" } }) as any as ReturnType<ReturnType<typeof person.create>>["vertex"]
                    }
                },
                many: async (query: WhereClause<ReturnType<ReturnType<typeof person.create>>["vertex"]> = { type: { eq: "person" } }) => {
                    return _many(query) as any as ReturnType<ReturnType<typeof person.create>>["vertex"][]
                }
            })
        })
        )
    }
}

const findQueryBuilder = <Domain>(database: ReturnType<typeof createDb>, queryBuilder: (one: <NodeType>(query: WhereClause<NodeType>) => any, many: <NodeType>(query: WhereClause<NodeType>) => any) => Domain): Domain => {
    return queryBuilder(
        oneQuery => {
            return database.then(db => [...db.searchNodes(oneQuery, { OFFSET: 0, LIMIT: 1 })][0])
        },
        manyQuery => {
            return database.then(db => [...db.searchNodes(manyQuery)])
        }
    )
}
