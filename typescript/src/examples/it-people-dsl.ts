import { DateTime } from "luxon"
import { linetrim, createDb, WhereClause } from "../index"

// Base DSL

type VertexFindOrCreate<VertexType extends string, Edges> = {
    vertex: NodeLike<VertexType>
} & {
        [key in keyof Edges]: Edges[key]
    }

type RawBuilder = <T extends (NodeLike<string> | EdgeLike<string>)>(...items: T[]) => number

type NodeLike<T extends string> = { id: string, type: T }
type VertexBuilder = <VertexType extends string>(node: NodeLike<VertexType>) => <Edges>(edges: Edges) => VertexFindOrCreate<VertexType, Edges>

type EdgeLike<T extends string> = { source: string, target: string, type: T }
type EdgeBuilder = <EdgeType extends string>(edge: EdgeLike<EdgeType>) => <TargetVertexCursor>(vertexTargets: TargetVertexCursor) => TargetVertexCursor

const nodeType = <NodeType extends string, CreateEdges = {}>(type: NodeType, build?: (
    builders: { $vertex: VertexBuilder, $edge: EdgeBuilder, $push: RawBuilder }, sourceName: string) => CreateEdges): {
        create: (
            $vertex: VertexBuilder,
            $edge: EdgeBuilder,
            $push: RawBuilder
        ) => (
                name: string
            ) => VertexFindOrCreate<NodeType, CreateEdges>;
    } => ({
        create: (
            $vertex: VertexBuilder,
            $edge: EdgeBuilder,
            $push: RawBuilder
        ) => (
            name: string
        ) => $vertex<NodeType>({
            id: `${type}/${name}`, type
        })(build ? build({ $vertex, $edge, $push }, name) : <CreateEdges>{})
    })


type EdgeType<T extends { create: any }> = ReturnType<ReturnType<T["create"]>>
type VertexType<T extends { create: any }> = ReturnType<ReturnType<T["create"]>>["vertex"]

// IT People DSL
const job = nodeType("job")
const company = nodeType("company")
const skill = nodeType("skill")
const occupation = nodeType("occupation", ({ $edge }, occupationName) => ({
    that: {
        mayRequire: (
            _skill: EdgeType<typeof skill>
        ) => $edge({
            type: "mayRequire",
            source: `occupation/${occupationName}`,
            target: _skill.vertex.id
        })({})
    }
}))
const person = nodeType("person", ({ $edge, $push  }, personName) => ({
    /* contextual edges */
    that: {
        worksAt: (
            _company: EdgeType<typeof company>,
            properties: {
                beginning: DateTime,
                ending?: DateTime,
                fulltime?: boolean,
            }
        ) => $edge({
            type: "worksAt", ...properties,
            source: `person/${personName}`,
            target: _company.vertex.id
        })({
            as: (
                _occupation: EdgeType<typeof occupation>,
                properties: {
                    // TODO: make properties an Omit<VertexType<typeof job>, "id" | "type"> such that this 'as' operation creates complexity
                }) => {
                /**
                 * Enhanced Behaviour:
                 * In this special scenario, 'as' behaves as: 
                 * 
                 *     person->>worksAt->company->as->>occupation(
                 *         occupation->>includesJob->job,
                 *         person->>hasJob->job,
                 *         person->>worksAs->occupation
                 *     )
                 * 
                 * ...such that edges are created opaquely
                 */
                // 0. create a job that looks alike the occupation
                const _jobId = `job/${_occupation.vertex.id.split("/")[1]}`
                $push(<VertexType<typeof job>>{ id: _jobId, type: "job" })
                // 1. connect the occupation to a job vert (occupation>>-includesJob->job->isWithinOccupation->>occupation)
                $push({ source: _occupation.vertex.id, target: _jobId, type: "includesJob" })
                // 2. connect the person to the job vert (person>>-hasJob->job->workedBy->>person)
                $push({ source:  `person/${personName}`, target: _jobId, type: "hasJob" })
                // 3. connect the person to the occupation vert (person>>-worksAs->occupation->doneBy->>person)
                $push({ source:  `person/${personName}`, target: _occupation.vertex.id, type: "worksAs" })
                return _occupation
            }
        }),
        usesTheSkill: (
            _skill: EdgeType<typeof skill>
        ) => $edge<"usesTheSkill">({
            type: "usesTheSkill",
            source: `person/${personName}`,
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
}))

type createBuilder = {
    company: ReturnType<typeof company.create>,
    skill: ReturnType<typeof skill.create>,
    person: ReturnType<typeof person.create>,
    occupation: ReturnType<typeof occupation.create>,
    // TODO: could these be keyed?
    dump: () => ({ node: NodeLike<string> } | { edge: EdgeLike<string> })[]
}

export const itPeopleDsl = (database: ReturnType<typeof createDb>) => {

    return {
        create: createActivity(database),

        find: findActivity(database, (_one, _many) => ({
            person: () => findActivityNodeOneOrMany<ReturnType<ReturnType<typeof person.create>>["vertex"]>("person", _one, _many),
            company: () => findActivityNodeOneOrMany<ReturnType<ReturnType<typeof company.create>>["vertex"]>("company", _one, _many),
        }))
    }
}

const createActivity = (database: ReturnType<typeof createDb>) => async <OptionalOutput>(query: ($: createBuilder) => OptionalOutput) => {
    const updates: ({ node: NodeLike<string> } | { edge: EdgeLike<string> })[] = []
    const $push = updates.push.bind(updates)
    const $vertex = <VertexType extends string>(node: NodeLike<VertexType>) => <Edges>(edges: Edges): VertexFindOrCreate<VertexType, Edges> => {
        $push({ node })
        return {
            vertex: node,
            ...edges
        }
    }
    const $edge = <EdgeType extends string>(edge: EdgeLike<EdgeType>) => <TargetVertexCursor>(vertexTargets: TargetVertexCursor) => {
        $push({ edge })
        return {
            ...vertexTargets
        }
    }
    const createOutput = query({
        company: company.create($vertex, $edge, <RawBuilder>$push),
        skill: skill.create($vertex, $edge, <RawBuilder>$push),
        person: person.create($vertex, $edge, <RawBuilder>$push),
        occupation: occupation.create($vertex, $edge, <RawBuilder>$push),
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
}

const findActivity = <Domain>(database: ReturnType<typeof createDb>, queryBuilder: (one: <NodeType>(query: WhereClause<NodeType>) => any, many: <NodeType>(query: WhereClause<NodeType>) => any) => Domain): Domain => {
    return queryBuilder(
        oneQuery => {
            return database.then(db => [...db.searchNodes(oneQuery, { OFFSET: 0, LIMIT: 1 })][0])
        },
        manyQuery => {
            return database.then(db => [...db.searchNodes(manyQuery)])
        }
    )
}

const findActivityNodeOneOrMany = <VertexType extends NodeLike<string>>(databaseNodeTypeName: string, _one: <NodeType>(query: WhereClause<NodeType>) => any, _many: <NodeType>(query: WhereClause<NodeType>) => any) => ({
    one: async (idOrQuery?: string | WhereClause<VertexType>) => {
        if (idOrQuery) {
            return _one(typeof idOrQuery === "string" ? <WhereClause<VertexType>>{ id: { eq: `${databaseNodeTypeName}/${idOrQuery}` } } : idOrQuery) as VertexType
        } else {
            return _one({ type: { eq: databaseNodeTypeName } }) as VertexType
        }
    },
    many: async (query = <WhereClause<VertexType>>{ type: { eq: databaseNodeTypeName } }) => {
        return _many(query) as any as VertexType[]
    }
})