import { DateTime } from "luxon"
import { VertexRef, objectHash, vertex, VertexModelRef, dsl } from "@src/design/index"

// IT People DSL
const job = vertex("job").withFields<{ level: "junior" | "mid" | "senior" }>()
const company = vertex("company")
const skill = vertex("skill")
const occupation = vertex("occupation").withApi(({ $edge }, occupationName) => ({
    that: {
        mayRequire: (
            _skill: VertexRef<typeof skill>
        ) => $edge({
            type: "mayRequire",
            source: `occupation/${occupationName}`,
            target: _skill.vertex.id
        })
    }
}))
const person = vertex("person").withApi(({ $edge, $push }, personName) => ({
    /* contextual edges */
    that: {
        worksAt: (
            _company: VertexRef<typeof company>,
            properties: {
                beginning: DateTime,
                ending?: DateTime,
                fulltime?: boolean,
            }
        ) => $edge({
            type: "worksAt", ...properties,
            source: `person/${personName}`,
            target: _company.vertex.id
        }, {
            as: (
                _occupation: VertexRef<typeof occupation>,
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
                    job: _occupation.vertex.id,
                    company: _company.vertex.id,
                    properties
                })
                const _jobId = `job/#${hash}`
                $push({ vertex: { id: _jobId, type: "job", name: _occupation.vertex.name, ...properties } })
                // 1. connect the occupation to a job vert (occupation>>-includesJob->job->isWithinOccupation->>occupation)
                $push({ edge: { source: _occupation.vertex.id, target: _jobId, type: "includesJob" } })
                // 2. connect the person to the job vert (person>>-hasJob->job->workedBy->>person)
                $push({ edge: { source: `person/${personName}`, target: _jobId, type: "hasJob" } })
                // 3. connect the person to the occupation vert (person>>-worksAs->occupation->doneBy->>person)
                $push({ edge: { source: `person/${personName}`, target: _occupation.vertex.id, type: "worksAs" } })
                // 4. connect job to company ver (job->>isPerformedFor->company)
                $push({ edge: { source: _jobId, target: _company.vertex.id, type: "isPerformedFor" } })
                return _occupation
            }
        }),
        usesTheSkill: (
            _skill: VertexRef<typeof skill>
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
