import { EdgeModel, Extendable, Props, RequiredOmitted, VertexModel, createDb } from "@src/index"

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
] | InsertableEdgeToVertices[]


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
    index: number
}

const convertToVertex = (model: InsertableVertex): VertexModel => {
    if (typeof model === "string") {
        return {
            type: "vertex",
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

const convertToEdge = (model: InsertableEdge): EdgeModel => {
    if (typeof model === "string") {
        return {
            type: "edge",
            id: model,
        } as EdgeModel
    } else {
        if (model.id || model.name) {
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
            if (doubles) {
                const subject = convertToVertex(single)
                // is this a tuple[] or a tuple?
                if (Array.isArray(doubles[0])) {

                } else {
                    const [predicate, object] = [convertToEdge(doubles[0] as InsertableEdge), convertToVertex(doubles[1] as InsertableVertex)]
                    predicate.source = predicate.source ?? subject.id
                    predicate.target = predicate.target ?? object.id
                    return db.then(db => db.insertMany(subject, predicate, object))
                }
            } else {
                const vertex = convertToVertex(single)
                return db.then(db => db.insertVertex(vertex))
            }
        },

        query: async (
            build: (utils: { val: () => DescriptorProxy, where: (...triple: TripleWhere[]) => { select: (row: (DescriptorProxy | Described)[]) => any } }) => any
        ) => {
            const values: DescriptorProxy[] = []
            const val = () => values[values.push({ index: values.length }) - 1]
            const where = (...triple: TripleWhere[]) => {
                return {
                    select: (row: (DescriptorProxy | Described)[]) => {
                        // TODO: transform this from SPARQL-like into SQL
                        return JSON.stringify(row)
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