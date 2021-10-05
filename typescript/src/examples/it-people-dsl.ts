import { DateTime } from "luxon"
import { createDb } from "@src/index"
import { EdgeType, objectHash, addVertex, VertexCreateType, createActivity, findActivity, findActivityNodeOneOrMany } from "@src/design/index"

// IT People DSL
const job = addVertex<"job", { level: "junior" | "mid" | "senior" | "principal" }>("job")
const company = addVertex("company")
const skill = addVertex("skill")
const occupation = addVertex("occupation", ({ $edge }, occupationName) => ({
    that: {
        mayRequire: (
            _skill: EdgeType<typeof skill>
        ) => $edge({
            type: "mayRequire",
            source: `occupation/${occupationName}`,
            target: _skill.vertex.id
        })
    }
}))
const person = addVertex("person", ({ $edge, $push }, personName) => ({
    /* contextual edges */
    that: {
        worksAt: (
            _company: EdgeType<typeof company>,
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
                _occupation: EdgeType<typeof occupation>,
                properties: Omit<VertexCreateType<typeof job>, "id" | "type" | "name">) => {
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
                $push({ vertex: <VertexCreateType<typeof job>>{ id: _jobId, type: "job", name: _occupation.vertex.name, ...properties } })
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
            _skill: EdgeType<typeof skill>
        ) => $edge({
            type: "usesTheSkill",
            source: `person/${personName}`,
            target: _skill.vertex.id
        }, {
            at: (
                _company: ReturnType<ReturnType<typeof company.create>>
            ) => {
                // TODO: what do we do here?
                return _company
            }
        })
    }
}))


// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const itPeopleDsl = (database: ReturnType<typeof createDb>) => {

    return {
        create: createActivity(database, {
            job,
            company,
            skill,
            person,
            occupation
        }),

        find: findActivity(database, (_one, _many) => ({
            person: () => findActivityNodeOneOrMany<ReturnType<ReturnType<typeof person.create>>["vertex"]>("person", _one, _many),
            company: () => findActivityNodeOneOrMany<ReturnType<ReturnType<typeof company.create>>["vertex"]>("company", _one, _many),
        }))
    }
}
