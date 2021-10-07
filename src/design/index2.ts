import { StringUnitLength } from "luxon"

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
    Name extends string,
    Namespace extends string,
    KnownProps extends Props | undefined = undefined,
    > = {
        $type: "edge"
        $name: Name
        $ns: Namespace
        $props: Extendable<KnownProps extends undefined ? (Props | undefined) : KnownProps>
    }

type VertexDescriptor<
    N extends string = string,
    NS extends string = string,
    P extends Extendable<Props> = any> = {
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
            type Descriptor = VertexDescriptor<N, NS, P extends undefined ? Props : P>
            return {
                describe: {
                    $type: "vertex" as const,
                    $name: name,
                    $ns: ns || "" as NS,
                    $props: (defaultProps || {}) as Extendable<P>,
                } as Descriptor,
                new: ((props: P) => {
                    return {
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

const edge = <N extends string = "", NS extends string = "">(
    name: N, ns?: NS
) => {
    return {
        from: <SD extends VertexDescriptor>(source: { describe: SD } | SD) => {
            return {
                to: <TD extends VertexDescriptor>(target: { describe: TD } | TD) => {
                    return {
                        as: <P extends Props | undefined = undefined>(defaultProps?: P) => {
                            type ThisEdge = P extends undefined ? (props?: Extendable<Props>) => EdgeModel<N, NS, Extendable<Props>> : (props: Extendable<P>) => EdgeModel<N, NS, Extendable<P>>
                            return {
                                describe: {
                                    $type: "edge" as const,
                                    $name: name,
                                    $ns: ns || "" as NS,
                                    $props: defaultProps || {} as Extendable<P>,
                                    $source: "describe" in source ? source.describe : source,
                                    $target: "describe" in target ? target.describe : target,
                                },
                                new: ((props: P) => {
                                    return {
                                        $type: "edge" as const,
                                        $name: name,
                                        $ns: ns || "" as NS,
                                        $props: props || defaultProps || {} as Extendable<P>,
                                    }
                                }) as ThisEdge
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

const bob = person.new({ name: "Bob" })
const acme = company.new({ name: "Acme"})

//insert(bob, [worksFor, acme])

const insert = <V extends VertexModel, E, VT>(single: V, double: [e: E, t: VT]) => {

}

type VertexModel<
    Name extends string = "",
    Namespace extends string = "",
    KnownProps extends Props | undefined = undefined,
    > = {
        $type: "vertex"
        $name: Name
        $ns: Namespace
        $props: Extendable<KnownProps extends undefined ? (Props | undefined) : KnownProps>
    }


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
