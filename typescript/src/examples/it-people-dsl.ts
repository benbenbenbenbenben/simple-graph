import { DateTime } from "luxon"

// Base DSL

type VertexFindOrCreate<VertexType extends string, Edges> = {
    vertex: NodeLike<VertexType>
} & {
        [key in keyof Edges]: Edges[key]
    }

type NodeLike<T extends string> = { id: string, type: T }
type CursorForVertex = <VertexType extends string>(node: NodeLike<VertexType>) => <Edges>(edges: Edges) => VertexFindOrCreate<VertexType, Edges>

type EdgeLike<T extends string> = { source: string, target: string, type: T }
type CursorForEdgeSourceToTarget = <EdgeType extends string>(edge: EdgeLike<EdgeType>) => <TargetVertexCursor>(vertexTargets: TargetVertexCursor) => TargetVertexCursor


// IT People DSL

const company = {
    create: (
        cursorForVertex: CursorForVertex,
        cursorForEdgeSourceToTarget: CursorForEdgeSourceToTarget
    ) => (
        name: string
    ) => cursorForVertex<"company">({
        id: `company/${name}`, type: "company"
    })({

    })
}
const skill = {
    create: (
        cursorForVertex: CursorForVertex,
        cursorForEdgeSourceToTarget: CursorForEdgeSourceToTarget
    ) => (
        name: string
    ) => cursorForVertex<"skill">({
        id: `skill/${name}`, type: "skill"
    })({

    })
}
const person = {
    create: (
        cursorForVertex: CursorForVertex,
        cursorForEdgeSourceToTarget: CursorForEdgeSourceToTarget
    ) => (
        name: string
    ) => cursorForVertex<"person">({
        id: `person/${name}`, type: "person"
    })({
        /* contextual edges */
        that: {
            worksAt: (
                _company: ReturnType<ReturnType<typeof company.create>>,
                properties: {
                    beginning: DateTime,
                    ending?: DateTime,
                    fulltime?: boolean,
                }) => cursorForEdgeSourceToTarget<"worksAt">({
                    type: "worksAt", ...properties,
                    source: `person/${name}`,
                    target: _company.vertex.id
                })({
                    as: (
                        _job: ReturnType<ReturnType<typeof job.create>>,
                        properties: {
                            //                         
                        }) => {
                        // TODO: what do we do here?
                        return _job
                    }
                }),
            usesTheSkill: (
                _skill: ReturnType<ReturnType<typeof skill.create>>
            ) => cursorForEdgeSourceToTarget<"usesTheSkill">({
                type: "usesTheSkill",
                source: `person/${name}`,
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
    })
}
const job = {
    create: (
        cursorForVertex: CursorForVertex,
        cursorForEdgeSourceToTarget: CursorForEdgeSourceToTarget
    ) => (
        name: string
    ) => cursorForVertex<"job">({ id: `job/${name}`, type: "job" })({
        that: {
            mayRequireTheSkill: (_skill: ReturnType<ReturnType<typeof skill.create>>) => {
                return _skill
            }
        }
    })
}

type createBuilder = {
    company: ReturnType<typeof company.create>,
    skill: ReturnType<typeof skill.create>,
    person: ReturnType<typeof person.create>,
    job: ReturnType<typeof job.create>,
    // TODO: could these be keyed?
    dump: () => (NodeLike<string> | EdgeLike<string>)[]
}

const before = <Func extends (...args: any[]) => any>(
    beforeFunc: (...input: Parameters<Func>) => Parameters<Func> | void
) => (func: Func) => (...input: Parameters<Func>): ReturnType<Func> =>
    func(beforeFunc(...input) || input)
const after = <Func extends (...args: any[]) => any>(
    afterFunc: (result: ReturnType<Func>) => ReturnType<Func> | void
) => (func: Func) => (...input: Parameters<Func>): ReturnType<Func> => {
    const result = func(input)
    return afterFunc(result) || result
}


export const create = <OptionalOutput>(query: ($: createBuilder) => OptionalOutput) => {
    const updates: any[] = []
    const cursorForVertex = <VertexType extends string>(node: NodeLike<VertexType>) => <Edges>(edges: Edges): VertexFindOrCreate<VertexType, Edges> => {
        updates.push({ node })
        return {
            vertex: node,
            ...edges
        }
    }
    const cursorForEdgeSourceToTarget = <EdgeType extends string>(edge: EdgeLike<EdgeType>) => <TargetVertexCursor>(vertexTargets: TargetVertexCursor) => {
        updates.push({ edge })
        return {
            ...vertexTargets
        }
    }
    const compilation = query({
        company: company.create(cursorForVertex, cursorForEdgeSourceToTarget),
        skill: skill.create(cursorForVertex, cursorForEdgeSourceToTarget),
        person: person.create(cursorForVertex, cursorForEdgeSourceToTarget),
        job: job.create(cursorForVertex, cursorForEdgeSourceToTarget),
        dump: () => [...updates]
    })
    return compilation;
}