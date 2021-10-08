import { whereClauseToSql } from "@src/index"

type PropType = number | string | boolean | { [x: string]: PropType }
type Props = {
    [x: string]: PropType | PropType[]
}
type Extendable<Obj> = Record<string, unknown> & Obj

type KnownSources = {

}

type KnownTargets = {

}

type EdgeModel<
    Name extends string = string,
    Namespace extends string = string,
    InverseName extends string = `inverse(${Name})`,
    KnownProps extends Props | undefined = any,
    > = {
        $type: "edge"
        $name: Name
        $inverseName: InverseName
        $ns: Namespace
        $props: Extendable<KnownProps extends undefined ? (Props | undefined) : KnownProps>
    }

type EdgeDescriptor<
    N extends string = string,
    NS extends string = string,
    IN extends string = `inverse(${N})`,
    P extends Extendable<Props> = any,
    SD extends VertexDescriptor = any,
    TD extends VertexDescriptor = any> = {
        $id: string
        $type: "edge",
        $name: N,
        $inverseName: IN,
        $ns: NS,
        $props: P,
        $source: SD
        $target: TD
    }


type VertexModel<
    Name extends string = string,
    Namespace extends string = string,
    KnownProps extends Props | undefined = any,
    > = {
        $id: string
        $type: "vertex"
        $name: Name
        $ns: Namespace
        $props: Extendable<KnownProps extends undefined ? (Props | undefined) : KnownProps>
    }



type VertexDescriptor<
    N extends string = string,
    NS extends string = string,
    P extends Extendable<Props> = any> = {
        $id: string
        $type: "vertex",
        $name: N,
        $ns: NS,
        $props: P,
    }

const vertex = <N extends string = "", NS extends string = "">(
    name: N, ns?: NS
) => {
    return {
        as: <P extends Props | undefined = undefined>(defaultProps?: P) => {
            type Creator = P extends undefined ? <C extends Props>(props?: Extendable<C>) => VertexModel<N, NS, Extendable<C>> : <C extends P>(props: Extendable<C>) => VertexModel<N, NS, Extendable<C>>
            type Descriptor = VertexDescriptor<N, NS, Extendable<(P extends undefined ? Props : P)>>
            return {
                describe: {
                    $id: "$automatic" as const,
                    $type: "vertex" as const,
                    $name: name,
                    $ns: ns || "" as NS,
                    $props: (defaultProps || {}) as Extendable<(P extends undefined ? Props : P)>,
                } as Descriptor,
                new: ((props: P) => {
                    return {
                        $id: "$automatic",
                        $type: "vertex" as const,
                        $name: name,
                        $ns: ns || "" as NS,
                        $props: props || defaultProps || {} as Extendable<P>,
                    }
                }) as Creator
            }
        }
    }
}

const edge = <N extends string = "", NS extends string = "", IN extends string = `inverse(${N})`>(
    name: N, ns?: NS, inverseName?: IN
) => {
    return {
        from: <SD extends VertexDescriptor>(source: { describe: SD } | SD) => {
            return {
                to: <TD extends VertexDescriptor>(target: { describe: TD } | TD) => {
                    return {
                        as: <P extends Props | undefined = undefined>(defaultProps?: P) => {
                            type Creator = P extends undefined ? <C extends Props>(props?: Extendable<C>) => EdgeModel<N, NS, IN, Extendable<C>> : <C extends P>(props: Extendable<C>) => EdgeModel<N, NS, IN, Extendable<C>>
                            type Descriptor = EdgeDescriptor<N, NS, IN, Extendable<(P extends undefined ? Props : P)>, SD, TD>
                            return {
                                describe: {
                                    $id: "$automatic" as const,
                                    $type: "edge" as const,
                                    $name: name,
                                    $inverseName: inverseName,
                                    $ns: ns || "" as NS,
                                    $props: (defaultProps || {}) as Extendable<(P extends undefined ? Props : P)>,
                                    $source: "describe" in source ? source.describe : source,
                                    $target: "describe" in target ? target.describe : target,
                                } as Descriptor,
                                new: ((props: P) => {
                                    return {
                                        $id: "$automatic",
                                        $type: "edge" as const,
                                        $name: name,
                                        $inverseName: inverseName,
                                        $ns: ns || "" as NS,
                                        $props: props || defaultProps || {} as Extendable<P>,
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


const person = vertex("person").as()
const company = vertex("company").as()
const worksFor = edge("worksFor").from(person).to(company).as()
const employs = edge("employs").from(company).to(person).as()

const bob = person.new({ name: "Bob" })
const acme = company.new({ name: "Acme" })

type EdgeToVertices = [
    edge: EdgeModel | EdgeDescriptor | { describe: EdgeDescriptor },
    target: (
        VertexModel |
        VertexModel[] |
        [
            VertexModel,
            EdgeToVertices
        ]
    )
] | EdgeToVertices[]

const insert = <
    V extends VertexModel,
    VT extends EdgeToVertices>(
        single: VertexModel, double?: EdgeToVertices,
        ...triple: [restsingle: V, restdouble?: VT][]
    ) => {
    if (double) {
        return [single, ...double]
    } else {
        return single
    }
}

insert(bob) // ?
insert(bob, [worksFor.new(), acme]) // ?
insert(acme, [worksFor, bob], [
    bob, []
]) // ?

insert(bob, [worksFor, [acme, [employs, bob]]])
insert(bob, [
    [worksFor, [acme]],
    [worksFor, [acme, acme, acme]],
    [worksFor, acme],
    [worksFor, [acme,
        [employs, bob]]
    ],
])

type CallableType<F extends (...args: any[]) => any, I extends any> = F & I
const createCallableType = <F extends (...args: any[]) => any, I extends any>(f: F, i: I): CallableType<F, I> => {
    Object.assign(f, i)
    return f as CallableType<F, I>
}

type NamedEdge<N extends string, > = {}

const one = createCallableType(() => 1, { x: 1 })
one.x //?
one //?
const where = (x: NamedEdge, y: any, _stack = []) => {



    const next = createCallableType(where, { select: (map: any) => true })
    return next
}

const isTypeOf = edge("isTypeOf")
const hasName = edge("hasName")
const hasMailbox = edge("hasMailbox")

const as = <N extends string>() => true

where(
    { subject: isTypeOf }, person
)(
    { subject: hasName }, as<"name">()
)(
    { subject: hasMailbox }, as<"email">()
).select({
    name: toString,
    email: toString
}) // ?



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