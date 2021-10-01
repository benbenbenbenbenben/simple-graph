import { DateTime } from "luxon"
import { createDb, linetrim } from "../index"
import { itPeopleDsl } from "./it-people-dsl"

describe("it-people-dsl", () => {
    test("create a person Joe Bloggs that works at Acme Inc. as a Software Developer", async () => {

        // bind the DSL to newly created database
        const database = createDb()
        const { create, find } = itPeopleDsl(database)

        // pin this DateTime so that jest expect work as expected *huh huh*
        const worksAtBeginning = DateTime.fromISO("2020-01-20")

        // run a graph create
        const joeBloggsQuery = create($ => {
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

            JoeBloggsIsAPersonThat.worksAt(AcmeInc, { beginning: worksAtBeginning }).as(SoftwareDeveloper, { level: "senior" })
            JoeBloggsIsAPersonThat.usesTheSkill(TypeScript).at(AcmeInc)
            JoeBloggsIsAPersonThat.usesTheSkill(Python).at(AcmeInc)
            JoeBloggsIsAPersonThat.usesTheSkill(AgileMethodologies).at(AcmeInc)

            // return all the updates so we can examine them (as .createOutput: any | void)
            return $.dump()
        })

        // run the graph
        const joeBloggsGraph = await joeBloggsQuery;
        expect(joeBloggsGraph.createOutput).toEqual([
            // nodes
            { node: { id: "company/Acme Inc.", type: "company" } },
            { node: { id: "skill/TypeScript", type: "skill" } },
            { node: { id: "skill/Python", type: "skill" } },
            { node: { id: "skill/Agile", type: "skill" } },
            { node: { id: "job/Software Developer", type: "job" } },
            { node: { id: "person/Joe Bloggs", type: "person" } },
            // edges
            { edge: { source: "person/Joe Bloggs", target: "company/Acme Inc.", type: "worksAt", beginning: worksAtBeginning } },
            { edge: { source: "person/Joe Bloggs", target: "skill/TypeScript", type: "usesTheSkill" } },
            { edge: { source: "person/Joe Bloggs", target: "skill/Python", type: "usesTheSkill" } },
            { edge: { source: "person/Joe Bloggs", target: "skill/Agile", type: "usesTheSkill" } },
        ])

        // verify the generated create SQL
        expect(joeBloggsGraph.preview()).toBe(linetrim`
            BEGIN TRANSACTION;

            INSERT INTO nodes VALUES (:0), (:1), (:2), (:3), (:4), (:5);
            INSERT INTO edges VALUES (:6), (:7), (:8), (:9);

            COMMIT TRANSACTION;
            SELECT 1 as ok;
        `)

        // assert the database is empty
        const count = (await database).raw("SELECT (SELECT count(*) FROM nodes) + (SELECT count(*) FROM edges) as total")[0][0].total
        expect(count).toBe(0)

        // execute the graph (apply it to the database)
        const execution = await joeBloggsGraph.execute()
        expect(execution).toBe(true)

        // find vertex (simple, none traversal)
        const joeBloggsFound = await find.person("Joe Bloggs").one()
        expect(joeBloggsFound).toEqual({
            id: "person/Joe Bloggs",
            type: "person"
        })

        find.person()
    })
})