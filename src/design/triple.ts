import { EdgeModel, Extendable, Props, RequiredOmitted, VertexModel, createDb, linetrim } from "@src/index"

type EdgeDescriptor<
    N extends string = string,
    NS extends string = string,
    IN extends string = `inverse(${N})`,
    P extends Extendable<Props> = any,
    SD extends VertexDescriptor = any,
    TD extends VertexDescriptor = any> = {
        type: "edge"
        id: string
        name: N
        inverseName: IN
        ns: NS
        source: SD
        target: TD
        props: P
    }

type VertexDescriptor<
    N extends string = string,
    NS extends string = string,
    P extends Extendable<Props> = any> = {
        type: "vertex"
        id: string
        name: N
        ns: NS
        props: P
    }

export const vertex = <N extends string = "", NS extends string = "">(
    name: N, ns?: NS
) => {
    type Creator = <C extends Props>(props?: Extendable<C>) => VertexModel<N, NS, Extendable<C>>
    type Descriptor = VertexDescriptor<N, NS, Extendable<Props>>
    return {
        describe: {
            id: "$automatic" as const,
            type: "vertex" as const,
            name: name,
            ns: ns || "" as NS,
            props: {} as Extendable<Props>,
        } as Descriptor,
        new: ((props: Props) => {
            return {
                id: "$automatic",
                type: "vertex" as const,
                name: name,
                ns: ns || "" as NS,
                props: props || {} as Extendable<Props>,
            }
        }) as Creator,
        as: <P extends Props | undefined = undefined>(defaultProps?: P) => {
            type Creator = P extends undefined ? <C extends Props>(props?: Extendable<C>) => VertexModel<N, NS, Extendable<C>> : <C extends P>(props: Extendable<C>) => VertexModel<N, NS, Extendable<C>>
            type Descriptor = VertexDescriptor<N, NS, Extendable<(P extends undefined ? Props : P)>>
            return {
                describe: {
                    id: "$automatic" as const,
                    type: "vertex" as const,
                    name: name,
                    ns: ns || "" as NS,
                    props: (defaultProps || {}) as Extendable<(P extends undefined ? Props : P)>,
                } as Descriptor,
                new: ((props: P) => {
                    return {
                        id: "$automatic",
                        type: "vertex" as const,
                        name: name,
                        ns: ns || "" as NS,
                        props: props || defaultProps || {} as Extendable<P>,
                    }
                }) as Creator
            }
        }
    }
}

export const edge = <N extends string = "", NS extends string = "", IN extends string = `inverse(${N})`>(
    name: N, ns?: NS, inverseName?: IN
) => {
    type Descriptor = EdgeDescriptor<N, NS, IN, Extendable<Props>>
    return {
        describe: {
            id: "$automatic" as const,
            type: "edge" as const,
            name: name,
            inverseName: inverseName,
            ns: ns || "" as NS,
            props: {} as Extendable<Props>,
            source: undefined,
            target: undefined,
        } as Descriptor,
        from: <SD extends VertexDescriptor>(source: { describe: SD } | SD) => {
            return {
                to: <TD extends VertexDescriptor>(target: { describe: TD } | TD) => {
                    return {
                        as: <P extends Props | undefined = undefined>(defaultProps?: P) => {
                            type Creator = P extends undefined ? <C extends Props>(props?: Extendable<C>) => EdgeModel<N, NS, IN, Extendable<C>> : <C extends P>(props: Extendable<C>) => EdgeModel<N, NS, IN, Extendable<C>>
                            type Descriptor = EdgeDescriptor<N, NS, IN, Extendable<(P extends undefined ? Props : P)>, SD, TD>
                            return {
                                describe: {
                                    id: "$automatic" as const,
                                    type: "edge" as const,
                                    name: name,
                                    inverseName: inverseName,
                                    ns: ns || "" as NS,
                                    props: (defaultProps || {}) as Extendable<(P extends undefined ? Props : P)>,
                                    source: "describe" in source ? source.describe : source,
                                    target: "describe" in target ? target.describe : target,
                                } as Descriptor,
                                new: ((props: P) => {
                                    return {
                                        id: "$automatic",
                                        type: "edge" as const,
                                        name: name,
                                        inverseName: inverseName,
                                        ns: ns || "" as NS,
                                        props: props || defaultProps || {} as Extendable<P>,
                                    }
                                }) as Creator
                            }
                        }
                    }
                }
            }
        },

    }
}


type InsertableVertex = string | RequiredOmitted<VertexModel, "id", "type"> | RequiredOmitted<VertexModel, "name", "type">
type InsertableEdge = string | RequiredOmitted<EdgeModel, "id", "type"> | RequiredOmitted<EdgeModel, "name", "type">

type InsertableEdgeToVertices = [
    edge: InsertableEdge | { describe: EdgeDescriptor },
    target: (
        InsertableVertex |
        InsertableVertex[] |
        [
            InsertableVertex,
            InsertableEdgeToVertices
        ]
    )
]


type CallableType<F extends (...args: any[]) => any, I extends any> = F & I
const createCallableType = <F extends (...args: any[]) => any, I extends any>(f: F, i: I): CallableType<F, I> => {
    Object.assign(f, i)
    return f as CallableType<F, I>
}
type Described = { describe: VertexDescriptor | EdgeDescriptor }
type TripleWhere = [
    Described, DescriptorProxy | Described, DescriptorProxy | Described
] | [
    DescriptorProxy | Described, Described, DescriptorProxy | Described
] | [
    DescriptorProxy | Described, DescriptorProxy | Described, Described
] | [
    Described, Described, Described /* traversal */
]
type DescriptorProxy = {
    $type: "DescriptorProxy"
    index: number
}

const convertToVertex = (model: InsertableVertex): VertexModel => {
    if (typeof model === "string") {
        return {
            type: "vertex",
            name: model,
            /* NOTE: id is used here because a vertex is unique in a triplestore i.e. there is only one John_Lennon */
            id: model,
        } as VertexModel
    } else {
        if (model.id || model.name) {
            return { ...model, id: model.id ?? model.name } as VertexModel
        } else {
            throw "Cannot convert the given model to an insertable vertex."
        }
    }
}

const convertToEdge = (model: InsertableEdge | { describe: EdgeDescriptor }): EdgeModel => {
    if (typeof model === "object" && "describe" in model && model.describe.type === "edge") {
        return model.describe
    }
    if (typeof model === "string") {
        return {
            type: "edge",
            name: model,
        } as EdgeModel
    } else {
        if (("id" in model && model.id) || ("name" in model && model.name)) {
            return model as EdgeModel
        } else {
            throw "Cannot convert the given model to an insertable vertex."
        }
    }
}

export const tripleStore = async (db: ReturnType<typeof createDb>) => {
    return {
        insert: async (
            single: InsertableVertex, doubles?: InsertableEdgeToVertices | InsertableEdgeToVertices[],
            ...triple: [restsingle: InsertableVertex, ...restdouble: InsertableEdgeToVertices[]][]
        ): Promise<any> => {
            const doublesIsArray = Array.isArray(doubles) && Array.isArray(doubles[0])
            const normalisedDoubles = (doublesIsArray ? <InsertableEdgeToVertices[]>doubles : (doubles ? [<InsertableEdgeToVertices>doubles] : []))
            const newTriple: typeof triple = [[single, ...normalisedDoubles], ...triple]


            const tripleMapInsert = (triple: [restsingle: InsertableVertex, ...restdouble: InsertableEdgeToVertices[]]) => {
                const subject = convertToVertex(triple[0])
                const edges: EdgeModel[] = []
                const objects: VertexModel[] = []
                if (triple.length > 1) {
                    triple.slice(1).forEach(double => {
                        const predicate = { ...convertToEdge((<InsertableEdgeToVertices>double)[0]), source: subject.id } // ?
                        edges.push(predicate)
                        const objectsOrTriples = (<InsertableEdgeToVertices>double)[1]
                        if (typeof objectsOrTriples === "string") {
                            objects.push({ ...convertToVertex(objectsOrTriples) })
                            predicate.target = objects[objects.length - 1].id
                            predicate.id = `${predicate.source}:${predicate.name}:${predicate.target}`
                        } else {
                            // TODO: deal with other object patterns in InsertableEdgeToVertices[1]
                            throw "not yet implemented"
                        }
                    })
                }
                return [<VertexModel>subject, ...<EdgeModel[]>edges, ...<VertexModel[]>objects]
            }

            const inserts = newTriple.map(tripleMapInsert).flat() //?

            const distinct = [...new Set(inserts.map(v => JSON.stringify(v)))].map(str => JSON.parse(str))
                ; (await db).insertMany(...distinct)
        },

        query: async (
            build: (utils: { val: () => DescriptorProxy, where: (...triple: TripleWhere[]) => { select: (row: (DescriptorProxy | Described)[]) => any } }) => any
        ) => {
            const values: DescriptorProxy[] = []
            const val = () => values[values.push({ $type: "DescriptorProxy", index: values.length }) - 1]
            const where = (...triples: TripleWhere[]) => {
                triples // ?

                return {
                    select: async (row: (DescriptorProxy | Described)[]) => {

                        const sqlLines: string[] = []
                        const sqlParams: string[] = []

                        row //?

                        const refs = triples.map(triple => triple.map(x => !("$type" in x && x.$type === "DescriptorProxy") ? (<Described>x).describe.name : <DescriptorProxy>x))
                        refs //?
                        refs.forEach(([sub, pred, obj]) => {
                            if (typeof sub === "string") {
                                sqlLines.push(`
                                    UNION SELECT -1, -1, -1, id, null, null FROM vertices
                                    WHERE name = ?
                                `)
                                sqlParams.push(sub)
                                if (typeof pred === "string") {
                                    sqlLines.push(`
                                        UNION SELECT -1, -1, -1, null, id, null FROM edges
                                        WHERE name = ?
                                        JOIN traverse ON source = sub
                                    `)
                                    sqlParams.push(pred)
                                    if (typeof obj === "string") {
                                        sqlLines.push(`
                                            UNION SELECT -1, -1, -1, null, null, id FROM vertices
                                            WHERE name = ?
                                            JOIN traverse ON target = pred
                                        `)
                                        sqlParams.push(obj)
                                    } else {
                                        sqlLines.push(`
                                            UNION SELECT -1, -1, ?, null, null, id FROM vertices
                                            JOIN traverse ON target = pred
                                        `)
                                        sqlParams.push(obj.index.toString())
                                    }
                                } else {
                                    sqlLines.push(`
                                        UNION SELECT -1, ?, -1, null, id, null FROM edges
                                        JOIN traverse ON source = sub
                                    `)
                                    sqlParams.push(pred.index.toString())
                                }
                            }
                        })


                        // TODO: transform this from SPARQL-like into SQL
                        const sql = linetrim`
                            --SELECT target AS val0 FROM edges WHERE source = 'The_Beatles' AND name = 'member'

                            WITH RECURSIVE traverse(sub, pred, obj) AS (
                                SELECT id, null, null FROM vertices
                                WHERE name = :sub0
                                UNION
                                SELECT source, id, target FROM edges
                                JOIN traverse ON source = sub
                                WHERE name = :pred0
                                UNION
                                SELECT null, null, id FROM vertices
                                JOIN traverse ON id = pred
                            ) SELECT obj FROM traverse LIMIT -1 OFFSET 1
                        `
                        try {
                            (await db).exec(sql, {
                                ":sub0": "The_Beatles", ":pred0": "member"
                            }) // ?
                        } catch (e) {
                            e // ?
                        }
                        //return JSON.stringify(row)
                    }
                }
            }
            return build({ val, where })
        },
    }
}

/*
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT ?name
       ?email
WHERE
  {
    ?person  a          foaf:Person .
    ?person  foaf:name  ?name .
    ?person  foaf:mbox  ?email .
  }
*/
/*
PREFIX ex: <http://example.com/exampleOntology#>
SELECT ?capital
       ?country
WHERE
  {
    ?x  ex:cityname       ?capital   ;
        ex:isCapitalOf    ?y         . // ?x is implicit subject
    ?y  ex:countryname    ?country   ;
        ex:isInContinent  ex:Africa  . // ?x is implicit subject
  }
*/