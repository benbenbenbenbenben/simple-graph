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
    KnownProps extends Props | undefined = any,
    > = {
        $type: "edge"
        $name: Name
        $ns: Namespace
        $props: Extendable<KnownProps extends undefined ? (Props | undefined) : KnownProps>
    }

type EdgeDescriptor<
    N extends string = string,
    NS extends string = string,
    P extends Extendable<Props> = any,
    SD extends VertexDescriptor = any,
    TD extends VertexDescriptor = any> = {
        $id: string
        $type: "edge",
        $name: N,
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
                    $name: name as N,
                    $ns: ns || "" as NS,
                    $props: (defaultProps || {}) as Extendable<(P extends undefined ? Props : P)>,
                } as Descriptor,
                new: ((props: P) => {
                    return {
                        $id: "$automatic" as const,
                        $type: "vertex" as const,
                        $name: name as N,
                        $ns: ns || "" as NS,
                        $props: props || defaultProps || {} as Extendable<P>,
                    }
                }) as Creator
            }
        }
    }
}

const edge = <N extends string = "", NS extends string = "">(
    name: N, ns?: NS
) => {
    return {
        from: <SD extends VertexDescriptor>(source: { describe: SD } | SD) => {
            return {
                to: <TD extends VertexDescriptor>(target: { describe: TD } | TD) => {
                    return {
                        as: <P extends Props | undefined = undefined>(defaultProps?: P) => {
                            type Creator = P extends undefined ? <C extends Props>(props?: Extendable<C>) => EdgeModel<N, NS, Extendable<C>> : <C extends P>(props: Extendable<C>) => EdgeModel<N, NS, Extendable<C>>
                            type Descriptor = EdgeDescriptor<N, NS, Extendable<(P extends undefined ? Props : P)>, SD, TD>
                            return {
                                describe: {
                                    $id: "$automatic" as const,
                                    $type: "edge" as const,
                                    $name: name as N,
                                    $ns: ns || "" as NS,
                                    $props: (defaultProps || {}) as Extendable<(P extends undefined ? Props : P)>,
                                    $source: "describe" in source ? source.describe : source,
                                    $target: "describe" in target ? target.describe : target,
                                } as Descriptor,
                                new: ((props: P) => {
                                    return {
                                        $id: "$automatic" as const,
                                        $type: "edge" as const,
                                        $name: name as N,
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

//insert(bob, [worksFor, acme])
type ExtractEdgeDescriptor<E extends EdgeDescriptor | { describe: EdgeDescriptor }> = E extends { describe: EdgeDescriptor } ? E["describe"] : E

type EdgeToVertices<S extends VertexModel, E extends EdgeDescriptor, T extends VertexModel = any> =
    S["$name"] extends E["$source"]["$name"] ?
    S["$ns"] extends E["$source"]["$ns"] ?
    E["$target"]["$name"] extends T["$name"] ?
    E["$target"]["$ns"] extends T["$ns"] ?
    [
        edge: E,
        target: T
    ] :
    { ERROR: "target and edge.target $ns values are not alike" } :
    { ERROR: "target and edge.target $name values are not alike" } :
    { ERROR: "source and edge.source $ns values are not alike" } :
    { ERROR: "source and edge.source $name values are not alike" };

const insert = <
    V extends VertexModel,
    E extends EdgeDescriptor>(
        single: V, double?: EdgeToVertices<V, E>
    ) => {
    if (double) {
        return [single, ...double]
    } else {
        return single
    }
}

insert(bob) // ?
insert(bob, [worksFor.describe, acme]) // ?
insert(acme, [worksFor.describe, bob]) // ?

insert(bob, [worksFor, acme])
// const insert = <A>(a: A) => {

// }

// const update = <A>(a: A) => {

// }

// const merge = <A>(a: A) => {

// }

// const drop = (id: string) => {

// }

// const connect = <A, B, AtoB, BtoA, P>({ from: A, to: B, as: [AtoB, BtoA], with: P }) => {

// }

// const disconnect = (id: string) => {

// }

// type eee = { connect: person, to: company, as: { person: "worksAt", company: "employs", with: { props: { since: string } } } }
