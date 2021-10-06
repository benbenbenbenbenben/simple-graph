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
    edge: EdgeLike<string, any>
}>(...items: T[]) => T[]

type PushVertex = <T extends string, P extends Props, V = VertexLike<T, P>>(...items: V[]) => V[]
type PushEdge = <T extends string, P extends Props, E = EdgeLike<T, P>>(...items: E[]) => E[]

type VertexLike<Type extends string, P extends Props = Props> = P & {
    id: string
    type: Type
    name: string,
}

type EdgeLike<Type extends string, P extends Props = Props> = P & {
    source: string;
    type: Type
    target: string;
}

export type VertexRef<T extends { create: (...args: never[]) => (...args: never[]) => unknown }> = ReturnType<
    ReturnType<T['create']>
>

export type VertexModelRef<T> = T extends VertexCompilation<string>
    ? ReturnType<ReturnType<ReturnType<T["withFields"]>["create"]>>[0]
    : never

type VertexCompile<
    VType extends string,
    VProps extends Props = any,
    > = (
        $vert: PushVertex,
        $edge: PushEdge,
    ) => (
            name: string, properties?: VProps
        ) => VertexLike<VType, VProps>[]

type VertexCompileWithFields<
    VType extends string,
    VProps extends Props = any,
    > = (
        $vert: PushVertex,
        $edge: PushEdge,
    ) => (
            name: string, properties: VProps
        ) => VertexLike<VType, VProps>[]


type DomainMap = {
    [typeName: string]: {
        create: VertexCompile<typeof typeName> | VertexCompileWithFields<typeof typeName>
    }
}

type DomainDefinition<Map extends DomainMap> = {
    [key in keyof Map]: ReturnType<Map[key]["create"]>
} & {
    dump: () => ({ vertex: VertexLike<string> } | { edge: EdgeLike<string> })[]
}

type PropType = number | string | boolean | { [x: string]: PropType }
type Props = {
    [x: string]: PropType | PropType[]
}

type CreateQueryBuilder<VType extends string, SourceProps extends Props> = (
    $vert: PushVertex,
    $edge: PushEdge,
    sourceName: string,
    properties: SourceProps,
    ...created: VertexLike<VType, SourceProps>[]
) => any

type VertexCompilation<VType extends string> = {
    create: VertexCompile<VType, Props>,
    withFields: <WithFieldsProps extends Props>() => {
        create: VertexCompileWithFields<VType, WithFieldsProps>,
        andApi: (
            build: CreateQueryBuilder<VType, WithFieldsProps>
        ) => {
            create: VertexCompileWithFields<VType, WithFieldsProps>,
        },
    },
    withApi: (
        build: CreateQueryBuilder<VType, Props>
    ) => {
        create: VertexCompileWithFields<VType, Props>,
    },
}

// vertex compiler
const _create = <T extends string, P extends Props = Props>(
    type: T
) => (
    $vert: PushVertex
) => (
    name: string, properties?: P
) => $vert(<VertexLike<T, P>>{
    id: `${type}/${name}`,
    name,
    type,
    ...properties
})

type VertexCompiler = <VType extends string>(type: VType) => VertexCompilation<VType>

export const vertex: VertexCompiler = <
    VType extends string,
    >(
        type: VType
    ): VertexCompilation<VType> => ({
        withFields: <WithFieldsProps extends Props>() => ({
            create: _create(type),
            andApi: (build: CreateQueryBuilder<VType, WithFieldsProps>) => ({
                create: (
                    $vert: PushVertex,
                    $edge: PushEdge,
                ) => (
                    name: string, properties: any
                ) => build(
                    $vert, $edge, name, properties,
                    ..._create<VType, WithFieldsProps>(type)($vert)(name, properties)
                )

            })
        }),
        create: _create(type),
        withApi: (build: CreateQueryBuilder<VType, Props>) => ({
            create: (
                $vert: PushVertex,
                $edge: PushEdge,
            ) => (
                name: string, properties: any
            ) => build(
                $vert, $edge, name, properties,
                ..._create<VType, Props>(type)($vert)(name, properties)
            )
        })
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

        const $vert: PushVertex = <
            T extends string, P extends Props, V = VertexLike<T, P>
        >(...items: V[]) => $push(...items.map(v => ({ vertex: v }))).map(vv => vv.vertex)

        const $edge: PushEdge = <
            T extends string, P extends Props, E = EdgeLike<T, P>
        >(...items: E[]) => $push(...items.map(e => ({ edge: e }))).map(ee => ee.edge)

        // company: company.create($vertex, $edge, <RawBuilder>$push),
        // skill: skill.create($vertex, $edge, <RawBuilder>$push),
        // person: person.create($vertex, $edge, <RawBuilder>$push),
        // occupation: occupation.create($vertex, $edge, <RawBuilder>$push),
        //...Object.entries(map).reduce((aggr, [type, { create }]) => ({ [type]: create($vertex, $edge, <RawBuilder>$push) }), {}),

        const definition = Object.entries(map).reduce(
            (a, [n, { create }]) => ({ ...a, [n]: create($vert, $edge) }),
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
    [key in keyof Map]: FindOneOrManyAPI<ReturnType<ReturnType<Map[key]['create']>>>
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
                [n]: findActivityNodeOneOrMany<ReturnType<ReturnType<typeof create>>[0]>(n, _one, _many),
            }), {})
        )
    })
}
