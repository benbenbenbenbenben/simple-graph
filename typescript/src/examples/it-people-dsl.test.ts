import { DateTime } from "luxon"
import { create } from "./it-people-dsl"

describe("it-people-dsl", () => {
    test("create a person Joe Bloggs that works at Acme Inc. as a Software Developer", async () => {
        const joeBloggs = create($ => {
            // company
            const AcmeInc = $.company("Acme Inc.")
            // skills
            const TypeScript = $.skill("TypeScript")
            const Python = $.skill("Python")
            const AgileMethodologies = $.skill("Agile")
            // job
            const SoftwareDeveloper = $.job("Software Developer")
            // person
            const JoeBloggs = $.person("Joe Bloggs")
            const { that: JoeBloggsIsAPersonThat } = JoeBloggs

            JoeBloggsIsAPersonThat.worksAt(AcmeInc, { beginning: DateTime.fromISO("2020-01-20") }).as(SoftwareDeveloper, { level: "senior" })
            JoeBloggsIsAPersonThat.usesTheSkill(TypeScript).at(AcmeInc)
            JoeBloggsIsAPersonThat.usesTheSkill(Python).at(AcmeInc)
            JoeBloggsIsAPersonThat.usesTheSkill(AgileMethodologies).at(AcmeInc)
        })
        const joeBloggsGraph = await joeBloggs;
        expect(joeBloggsGraph).toStrictEqual([
            { id: "company/Acme Inc.", type: "company" },
            { id: "skill/TypeScript", type: "skill" },
            { id: "skill/Python", type: "skill" },
            { id: "skill/Agile", type: "skill" },
            { id: "job/Software Developer", type: "job" },
            { id: "person/Joe Bloggs", type: "person" },
        ])
    })
})