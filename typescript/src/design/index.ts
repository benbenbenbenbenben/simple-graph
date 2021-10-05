import { createDb, linetrim, WhereClause } from '@src/index'

type VertexFindOrCreate<
    VLike,
    Edges,
    > = {
        vertex: VLike
    } & Edges

type VertexBuilder = <
    VType extends string,
    VProps extends Props,
    >(
    vertex: VertexLike<VType, VProps>,
) => <Edges>(edges: Edges) => VertexFindOrCreate<
    VertexLike<VType, VProps>,
    Edges
>

type EdgeBuilder = <
    EType extends string,
    VTargets extends Record<string, unknown>
    >(
    edge: EdgeLike<EType>,
    vertexTargets?: VTargets,
) => VTargets

type RawBuilder = <T extends {
    vertex: VertexLike<string, any>
} | {
    edge: EdgeLike<string>
}>(...items: T[]) => T[]

type VertexLike<Type extends string, P extends Record<string, unknown> = Record<string, unknown>> = P & {
    id: string
    type: Type
    name: string,
}

type EdgeLike<T extends string> = { source: string; target: string; type: T }

export type EdgeType<T extends { create: (...args: never[]) => (...args: never[]) => unknown }> = ReturnType<
    ReturnType<T['create']>
>

export type VertexCreateType<
    T extends { create: (...args: never[]) => (...args: never[]) => { vertex: VertexLike<string> } },
    > = ReturnType<ReturnType<T['create']>>['vertex']

type VertexCreate<
    VType extends string,
    VProps extends Props = any,
    Edges = Record<string, unknown>
    > = (
        vertex: VertexBuilder, edge: EdgeBuilder, raw: RawBuilder
    ) => (name: string, properties?: VProps) => VertexFindOrCreate<VertexLike<VType, VProps>, Edges>

type DomainMap = {
    [typeName: string]: {
        create: VertexCreate<typeof typeName>
    }
}

type DomainDefinition<Map extends DomainMap> = {
    [key in keyof Map]: ReturnType<Map[key]["create"]>
} & {
    dump: () => ({ vertex: VertexLike<string> } | { edge: EdgeLike<string> })[]
}

type Props = {
    [x: string]: number | string | boolean | Props
}

export const addVertex = <
    VType extends string,
    VProps extends Props = Props,
    CreateEdges = Record<string, unknown>,
    >(
        type: VType,
        build?: (
            build: { $vertex: VertexBuilder; $edge: EdgeBuilder; $push: RawBuilder },
            sourceName: string,
        ) => CreateEdges,
): {
    create: VertexCreate<VType, VProps, CreateEdges>
} => ({
    create: (
        $vertex: VertexBuilder,
        $edge: EdgeBuilder,
        $push: RawBuilder
    ) => (
        name: string, properties?: VProps
    ) =>
            $vertex<
                VType,
                VProps
            >(<VertexLike<VType, VProps>>{
                id: `${type}/${name}`,
                name,
                type,
                ...properties
            })(build ? build({ $vertex, $edge, $push }, name) : <CreateEdges>{}),
})



export const createActivity = <
    Map extends DomainMap
>(database: ReturnType<typeof createDb>, map: Map) =>
    <OptionalOutput>(query: ($: DomainDefinition<Map>) => OptionalOutput) => {
        // TODO: encapsulate as type, updatesString and updates are in sync
        const updatesStrings: string[] = []
        const updates: ({ vertex: VertexLike<string> } | { edge: EdgeLike<string> })[] = []
        const $push: RawBuilder = (...items) => {
            // TODO: warn of duplicated pushes
            const itemsToPush = items.filter((item) => !updatesStrings.includes(JSON.stringify(item)))
            updates.push(...itemsToPush)
            updatesStrings.push(...itemsToPush.map((item) => JSON.stringify(item)))
            return itemsToPush
        }
        const $vertex =
            <
                VertexType extends string,
                Properties extends Record<string, unknown>,
                VLike = VertexLike<VertexType, Properties>
            >(
                vertex: VLike,
            ) =>
                <Edges>(edges: Edges): VertexFindOrCreate<VLike, Edges> => {
                    $push({ vertex })
                    return {
                        vertex: vertex,
                        ...edges,
                    }
                }
        const $edge: EdgeBuilder = <EdgeType extends string, T>(edge: EdgeLike<EdgeType>, vertexTargets?: T): T => {
            $push({ edge })
            /* TODO: without this annotation there is a ts2322 */
            return <T>vertexTargets
        }
        // company: company.create($vertex, $edge, <RawBuilder>$push),
        // skill: skill.create($vertex, $edge, <RawBuilder>$push),
        // person: person.create($vertex, $edge, <RawBuilder>$push),
        // occupation: occupation.create($vertex, $edge, <RawBuilder>$push),
        //...Object.entries(map).reduce((aggr, [type, { create }]) => ({ [type]: create($vertex, $edge, <RawBuilder>$push) }), {}),

        const definition = Object.entries(map).reduce(
            (a, [n, { create }]) => ({ ...a, [n]: create($vertex, $edge, $push) }),
            <DomainDefinition<Map>>{
                dump: () => [...updates]
            })
        const createOutput = query(
            definition
        )


        // TODO: convert updates to query and execute (behind an await)
        const vertices = (<never[]>updates).map(({ vertex }) => vertex as VertexLike<string>).filter((x) => x)
        const edges = (<never[]>updates).map(({ edge }) => edge as EdgeLike<string>).filter((x) => x)
        const sql = linetrim`
        BEGIN TRANSACTION;
        
        INSERT INTO vertices VALUES ${vertices.map((_, i) => `(:${i})`).join(', ')};
        INSERT INTO edges VALUES ${edges.map((_, i) => `(:${vertices.length + i})`).join(', ')};

        COMMIT TRANSACTION;
        SELECT 1 as ok;
    `
        return {
            preview: () => sql,
            commit: async () => {
                const db = await database
                const result = db.raw(sql, ...[...vertices, ...edges].map((vertex) => JSON.stringify(vertex)))
                return result[0][0].ok === 1
            },
            createOutput,
        }
    }

export const findActivity = <Domain>(
    database: ReturnType<typeof createDb>,
    queryBuilder: (
        one: <VertexType>(query: WhereClause<VertexType>) => any,
        many: <VertexType>(query: WhereClause<VertexType>) => any,
    ) => Domain,
): Domain => {
    return queryBuilder(
        (oneQuery) => {
            return database.then((db) => [...db.searchVertices(oneQuery, { OFFSET: 0, LIMIT: 1 })][0])
        },
        (manyQuery) => {
            return database.then((db) => [...db.searchVertices(manyQuery)])
        },
    )
}

export const findActivityNodeOneOrMany = <VertexType extends VertexLike<string>>(
    databaseNodeTypeName: string,
    _one: <VertexType>(query: WhereClause<VertexType>) => any,
    _many: <VertexType>(query: WhereClause<VertexType>) => any,
) => ({
    one: async (idOrQuery?: string | WhereClause<VertexType>) => {
        if (idOrQuery) {
            return _one(
                typeof idOrQuery === 'string'
                    ? <WhereClause<VertexType>>{ id: { eq: `${databaseNodeTypeName}/${idOrQuery}` } }
                    : idOrQuery,
            ) as VertexType
        } else {
            return _one({ type: { eq: databaseNodeTypeName } }) as VertexType
        }
    },
    many: async (query = <WhereClause<VertexType>>{ type: { eq: databaseNodeTypeName } }) => {
        return _many(query) as VertexType[]
    },
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
