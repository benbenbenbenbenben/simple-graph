import { DateTime } from "luxon"
import { objectHash, vertex, VertexModelRef, dsl } from "@src/design/index"

// IT People DSL
const job = vertex("job").withFields<{ level: "junior" | "mid" | "senior" }>()
const company = vertex("company")
const skill = vertex("skill")
const occupation = vertex("occupation").withApi(($vert, $edge, occupationName) => ({
    that: {
        mayRequire: (
            _skill: typeof skill
        ) => $edge({
            type: "mayRequire",
            source: `occupation/${occupationName}`,
            target: _skill
        })
    }
}))
const person = vertex("person").withApi(($vert, $edge , personName) => ({
    /* contextual edges */
    that: {
        worksAt: (
            _company: VertexModelRef<typeof company>,
            properties: {
                beginning: DateTime,
                ending?: DateTime,
                fulltime?: boolean,
            }
        ) => $edge({
            type: "worksAt", ...properties,
            source: `person/${personName}`,
            target: _company
        }, {
            as: (
                _occupation: VertexModelRef<typeof occupation>,
                properties: Omit<VertexModelRef<typeof job>, "id" | "type" | "name">) => {
                /**
                 * Enhanced Behaviour:
                 * In this special scenario, 'as' behaves as: 
                 * 
                 *     person->>worksAt->company->as->>occupation(
                 *         occupation->>includesJob->job,
                 *         person->>hasJob->job,
                 *         person->>worksAs->occupation,
                 *         job->>isPerformedFor->company
                 *     )
                 * 
                 * ...such that edges are created opaquely
                 */
                // 0. create a job that looks alike the occupation - we create a deterministic id for this specific job
                const hash = objectHash({
                    person: `person/${personName}`,
                    job: _occupation.id,
                    company: _company.id,
                    properties
                })
                const _jobId = `job/#${hash}`
                $push({ vertex: { id: _jobId, type: "job", name: _occupation.name, ...properties } })
                // 1. connect the occupation to a job vert (occupation>>-includesJob->job->isWithinOccupation->>occupation)
                $edge({ source: _occupation.id, target: _jobId, type: "includesJob" })
                // 2. connect the person to the job vert (person>>-hasJob->job->workedBy->>person)
                $edge({ source: `person/${personName}`, target: _jobId, type: "hasJob" })
                // 3. connect the person to the occupation vert (person>>-worksAs->occupation->doneBy->>person)
                $edge({ source: `person/${personName}`, target: _occupation.id, type: "worksAs" })
                // 4. connect job to company ver (job->>isPerformedFor->company)
                $edge({ source: _jobId, target: _company.id, type: "isPerformedFor" })
                return _occupation
            }
        }),
        usesTheSkill: (
            _skill: VertexModelRef<typeof skill>
        ) => $edge({
            type: "usesTheSkill",
            source: `person/${personName}`,
            target: _skill.vertex.id
        }, {
            at: (
                _company: VertexRef<typeof company>
            ) => {
                // TODO: what do we do here?
                return _company
            }
        })
    }
}))

export const itPeopleDsl = dsl({
    job,
    company,
    skill,
    person,
    occupation,
})
