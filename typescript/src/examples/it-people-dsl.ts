import { DateTime } from "luxon"
import { linetrim, createDb, WhereClause } from "../index"

// Base DSL

type VertexFindOrCreate<VertexType extends string, Edges, VertexProperties extends Record<string, unknown>> = {
    vertex: VertexLike<VertexType, VertexProperties>
} & {
        [key in keyof Edges]: Edges[key]
    }

type RawBuilder = <T extends ({ vertex: VertexLike<string> } | { edge: EdgeLike<string> }) >(...items: T[]) => void

type VertexLike<Type extends string, P extends Record<string, unknown> = Record<string, unknown>> = P & { id: string, type: Type, name: string }
type VertexBuilder = <VertexType extends string, Properties extends Record<string, unknown> = Record<string, unknown>>(node: VertexLike<VertexType, Properties>) => <Edges>(edges: Edges) => VertexFindOrCreate<VertexType, Edges, Properties>

type EdgeLike<T extends string> = { source: string, target: string, type: T }
type EdgeBuilder = <EdgeType extends string>(edge: EdgeLike<EdgeType>) => <TargetVertexCursor>(vertexTargets: TargetVertexCursor) => TargetVertexCursor

const addVertex = <VertexType extends string, Properties extends Record<string, unknown> = Record<string, unknown>, CreateEdges = Record<string, unknown>>(type: VertexType, build?: (
    builders: { $vertex: VertexBuilder, $edge: EdgeBuilder, $push: RawBuilder }, sourceName: string) => CreateEdges): {
        create: (
            $vertex: VertexBuilder,
            $edge: EdgeBuilder,
            $push: RawBuilder
        ) => (
                name: string
            ) => VertexFindOrCreate<VertexType, CreateEdges, Properties>;
    } => ({
        create: (
            $vertex: VertexBuilder,
            $edge: EdgeBuilder,
            $push: RawBuilder
        ) => (
            name: string
        ) => $vertex<VertexType, Properties>(/* TODO: this cast is needed, but why is it? */<VertexLike<VertexType, Properties>>{
            id: `${type}/${name}`, name, type
        })(build ? build({ $vertex, $edge, $push }, name) : <CreateEdges>{})
    })


type EdgeType<T extends { create: (...args: never[]) => (...args: never[]) => unknown }> = ReturnType<ReturnType<T["create"]>>
type VertexType<T extends { create: (...args: never[]) => (...args: never[]) => { vertex: VertexLike<string> } }> = ReturnType<ReturnType<T["create"]>>["vertex"]








// IT People DSL
const job = addVertex<"job", { level: "junior" | "mid" | "senior" | "principal" }>("job")
const company = addVertex("company")
const skill = addVertex("skill")
const occupation = addVertex("occupation", ({ $edge }, occupationName) => ({
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
const person = addVertex("person", ({ $edge, $push }, personName) => ({
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
                properties: Omit<VertexType<typeof job>, "id" | "type" | "name">) => {
                /**
                 * Enhanced Behaviour:
                 * In this special scenario, 'as' behaves as: 
                 * 
                 *     person->>worksAt->company->as->>occupation(
                 *         occupation->>includesJob->job,
                 *         person->>hasJob->job,
                 *         person->>worksAs->occupation,
                 *         job->>isPerformedFor->company
                 *     )
                 * 
                 * ...such that edges are created opaquely
                 */
                // 0. create a job that looks alike the occupation - we create a deterministic id for this specific job
                const hash = objectHash({
                    person: `person/${personName}`,
                    job: _occupation.vertex.id,
                    company: _company.vertex.id,
                    properties
                })
                const _jobId = `job/#${hash}`
                $push({ vertex: <VertexType<typeof job>>{ id: _jobId, type: "job", name: _occupation.vertex.name, ...properties } })
                // 1. connect the occupation to a job vert (occupation>>-includesJob->job->isWithinOccupation->>occupation)
                $push({ edge: { source: _occupation.vertex.id, target: _jobId, type: "includesJob" } })
                // 2. connect the person to the job vert (person>>-hasJob->job->workedBy->>person)
                $push({ edge: { source: `person/${personName}`, target: _jobId, type: "hasJob" } })
                // 3. connect the person to the occupation vert (person>>-worksAs->occupation->doneBy->>person)
                $push({ edge: { source: `person/${personName}`, target: _occupation.vertex.id, type: "worksAs" } })
                // 4. connect job to company ver (job->>isPerformedFor->company)
                $push({ edge: { source: _jobId, target: _company.vertex.id, type: "isPerformedFor" } })
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
    dump: () => ({ vertex: VertexLike<string> } | { edge: EdgeLike<string> })[]
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
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
    // TODO: encapsulate as type, updatesString and updates are in sync
    const updatesStrings: string[] = []
    const updates: ({ vertex: VertexLike<string> } | { edge: EdgeLike<string> })[] = []
    const $push: RawBuilder = (...items) => {
        // TODO: warn of duplicated pushes
        const itemsToPush = items.filter(item => !updatesStrings.includes(JSON.stringify(item)))
        updates.push(...itemsToPush)
        updatesStrings.push(...itemsToPush.map(item => JSON.stringify(item)))
    }
    const $vertex = <VertexType extends string, Properties extends Record<string, unknown>>(vertex: VertexLike<VertexType> & Properties) => <Edges>(edges: Edges): VertexFindOrCreate<VertexType, Edges, Properties> => {
        $push({ vertex })
        return {
            vertex: vertex,
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
    const vertices = (<never[]>updates).map(({ vertex }) => vertex as VertexLike<string>).filter(x => x)
    const edges = (<never[]>updates).map(({ edge }) => edge as EdgeLike<string>).filter(x => x)
    const sql = linetrim`
        BEGIN TRANSACTION;
        
        INSERT INTO vertices VALUES ${vertices.map((_, i) => `(:${i})`).join(", ")};
        INSERT INTO edges VALUES ${edges.map((_, i) => `(:${vertices.length + i})`).join(", ")};

        COMMIT TRANSACTION;
        SELECT 1 as ok;
    `
    return {
        preview: () => sql,
        execute: async () => {
            const db = await database
            const result = db.raw(sql, ...[...vertices, ...edges].map(vertex => JSON.stringify(vertex)))
            return result[0][0].ok === 1
        },
        createOutput
    };
}

const findActivity = <Domain>(database: ReturnType<typeof createDb>, queryBuilder: (one: <VertexType>(query: WhereClause<VertexType>) => any, many: <VertexType>(query: WhereClause<VertexType>) => any) => Domain): Domain => {
    return queryBuilder(
        oneQuery => {
            return database.then(db => [...db.searchVertices(oneQuery, { OFFSET: 0, LIMIT: 1 })][0])
        },
        manyQuery => {
            return database.then(db => [...db.searchVertices(manyQuery)])
        }
    )
}

const findActivityNodeOneOrMany = <VertexType extends VertexLike<string>>(databaseNodeTypeName: string, _one: <VertexType>(query: WhereClause<VertexType>) => any, _many: <VertexType>(query: WhereClause<VertexType>) => any) => ({
    one: async (idOrQuery?: string | WhereClause<VertexType>) => {
        if (idOrQuery) {
            return _one(typeof idOrQuery === "string" ? <WhereClause<VertexType>>{ id: { eq: `${databaseNodeTypeName}/${idOrQuery}` } } : idOrQuery) as VertexType
        } else {
            return _one({ type: { eq: databaseNodeTypeName } }) as VertexType
        }
    },
    many: async (query = <WhereClause<VertexType>>{ type: { eq: databaseNodeTypeName } }) => {
        return _many(query) as VertexType[]
    }
})

export const objectHash = (obj: unknown): number => {
    const str = JSON.stringify(obj)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash += Math.pow(str.charCodeAt(i) * 31, str.length - i)
        hash = hash & hash
    }
    return hash
}