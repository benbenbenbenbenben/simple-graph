import { DateTime } from "luxon"

// Base DSL

type VertexFindOrCreate<VertexType extends string, Edges> = {
    vertex: NodeLike<VertexType>
} & {
        [key in keyof Edges]: Edges[key]
    }

type NodeLike<T extends string> = { id: string, type: T }

const cursorForVertex = <VertexType extends string>(node: NodeLike<VertexType>) => <Edges>(edges: Edges): VertexFindOrCreate<VertexType, Edges> => {
    return {
        vertex: node,
        ...edges
    }
}

type EdgeLike<T extends string> = { type: T }

const cursorForEdgeSourceToTarget = <EdgeType extends string>(edge: EdgeLike<EdgeType>) => <TargetVertexCursor>(vertexTargets: TargetVertexCursor) => {
    return {
        ...vertexTargets
    }
}

// IT People DSL

const company = {
    create: (name: string) => cursorForVertex<"company">({
        id: `company/${name}`, type: "company"
    })({

    })
}
const skill = {
    create: (name: string) => cursorForVertex<"skill">({
        id: `skill/${name}`, type: "skill"
    })({

    })
}
const person = {
    create: (name: string) => cursorForVertex<"person">({
        id: `person/${name}`, type: "person"
    })({
        /* contextual edges */
        that: {
            worksAt: (
                _company: ReturnType<typeof company.create>,
                properties: {
                    beginning: DateTime,
                    ending?: DateTime,
                    fulltime?: boolean,
                }) => cursorForEdgeSourceToTarget<"worksAt">({ type: "worksAt", ...properties })({
                    as: (
                        _job: ReturnType<typeof job.create>,
                        properties: {
                            //                         
                        }) => {
                        // TODO: what do we do here?
                        return _job
                    }
                }),
            usesTheSkill: (
                    _skill: ReturnType<typeof skill.create>
                ) => cursorForEdgeSourceToTarget<"usesTheSkill">({ type: "usesTheSkill" })({
                    at: (
                        _company: ReturnType<typeof company.create>
                    ) => {
                        // TODO: what do we do here?
                        return _company
                    }
                })
        }
    })
}
const job = {
    create: (name: string) => cursorForVertex<"job">({ id: `job/${name}`, type: "job" })({
        that: {
            mayRequireTheSkill: (_skill: ReturnType<typeof skill.create>) => {
                return _skill
            }
        }
    })
}

type createBuilder = {
    company: typeof company.create,
    skill: typeof skill.create,
    person: typeof person.create,
    job: typeof job.create,
}

export const create = (query: ($: createBuilder) => void) => {

}