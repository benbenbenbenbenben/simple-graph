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

export type VertexRef<T extends { create: (...args: never[]) => (...args: never[]) => unknown }> = ReturnType<
    ReturnType<T['create']>
>

export type VertexModelRef<
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
            properties?: VProps,
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
            })(build ? build({ $vertex, $edge, $push }, name, properties) : <CreateEdges>{}),
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

export const findActivity = <Map extends DomainMap>(
    database: ReturnType<typeof createDb>,
    queryBuilder: (
        one: <VertexType>(query: WhereClause<VertexType>) => any,
        many: <VertexType>(query: WhereClause<VertexType>) => any,
    ) => Map,
): Map => {
    return queryBuilder(
        (oneQuery) => {
            return database.then((db) => [...db.searchVertices(oneQuery, { OFFSET: 0, LIMIT: 1 })][0])
        },
        (manyQuery) => {
            return database.then((db) => [...db.searchVertices(manyQuery)])
        },
    )
}

type FindOne<V> = (idOrQuery?: string | WhereClause<V>) => Promise<V>
type FindMany<V> = (idOrQuery?: string | WhereClause<V>) => Promise<V[]>

type FindOneOrManyAPI<V> = {
    one: FindOne<V>
    many: FindMany<V>
}


type FindOneOrManyMap<Map extends DomainMap> = {
    [key in keyof Map]: FindOneOrManyAPI<ReturnType<ReturnType<Map[key]['create']>>['vertex']>
}

export const findActivityNodeOneOrMany = <VLike extends VertexLike<string>>(
    databaseNodeTypeName: string,
    _one: <VertexType>(query: WhereClause<VertexType>) => any,
    _many: <VertexType>(query: WhereClause<VertexType>) => any,
): FindOneOrManyAPI<VLike> => ({
    one: async (idOrQuery?: string | WhereClause<VLike>) => {
        if (idOrQuery) {
            return _one(
                typeof idOrQuery === 'string'
                    ? <WhereClause<VLike>>{ id: { eq: `${databaseNodeTypeName}/${idOrQuery}` } }
                    : idOrQuery,
            ) as VLike
        } else {
            return _one({ type: { eq: databaseNodeTypeName } }) as VLike
        }
    },
    many: async (idOrQuery?: string | WhereClause<VLike>) => {
        if (idOrQuery) {
            return _many(
                typeof idOrQuery === 'string'
                    ? <WhereClause<VLike>>{
                        id:
                            { eq: `${databaseNodeTypeName}/${idOrQuery}` },
                        type:
                            { eq: databaseNodeTypeName }
                    }
                    : idOrQuery,
            ) as VLike[]
        } else {
            return _many({
                type:
                    { eq: databaseNodeTypeName }
            }) as VLike[]
        }
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


export const dsl = <Map extends DomainMap>(
    domain: Map
) => {
    return (
        database: ReturnType<typeof createDb>
    ) => ({
        create: createActivity(database, domain),
        find: <FindOneOrManyMap<Map>>findActivity(database, (_one, _many) =>
            Object.entries(domain).reduce((fa, [n, { create }]) => ({
                ...fa,
                [n]: findActivityNodeOneOrMany<ReturnType<ReturnType<typeof create>>["vertex"]>(n, _one, _many),
            }), {})
        )
    })
}
