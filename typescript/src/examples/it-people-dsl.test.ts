import { DateTime } from "luxon"
import { createDb, linetrim } from "../index"
import { itPeopleDsl } from "./it-people-dsl"

describe("it-people-dsl", () => {
    test("create a person Joe Bloggs that works at Acme Inc. as a Software Developer", async () => {

        // bind the DSL to newly created database
        const database = createDb()
        const { create, find } = itPeopleDsl(database)

        // pin this DateTime so that jest expect work as expected *huh huh*
        const worksAtAcmeBeginning = DateTime.fromISO("2020-01-20")
        const worksAtWidgetFactoryBeginning = DateTime.fromISO("2019-01-01")
        const worksAtWidgetFactoryEnding = DateTime.fromISO("2019-12-01")

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

            JoeBloggsIsAPersonThat.worksAt(AcmeInc, { beginning: worksAtAcmeBeginning }).as(SoftwareDeveloper, { level: "senior" })
            JoeBloggsIsAPersonThat.usesTheSkill(TypeScript).at(AcmeInc)
            JoeBloggsIsAPersonThat.usesTheSkill(Python).at(AcmeInc)
            JoeBloggsIsAPersonThat.usesTheSkill(AgileMethodologies).at(AcmeInc)

            // Joe worked at Widget Factory
            const WidgetFactory = $.company("Widget Factory")
            JoeBloggsIsAPersonThat.worksAt(WidgetFactory, { beginning: worksAtWidgetFactoryBeginning, ending: worksAtWidgetFactoryEnding }).as(SoftwareDeveloper, { level: "mid" })

            // connect Software Developer to Agile skill
            const { that: SoftwareDeveloperIsARoleThat } = SoftwareDeveloper
            SoftwareDeveloperIsARoleThat.mayRequire(AgileMethodologies)

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
            { edge: { source: "person/Joe Bloggs", target: "company/Acme Inc.", type: "worksAt", beginning: worksAtAcmeBeginning } },
            { edge: { source: "person/Joe Bloggs", target: "skill/TypeScript", type: "usesTheSkill" } },
            { edge: { source: "person/Joe Bloggs", target: "skill/Python", type: "usesTheSkill" } },
            { edge: { source: "person/Joe Bloggs", target: "skill/Agile", type: "usesTheSkill" } },
            // extra
            { node: { id: "company/Widget Factory", type: "company" } },
            { edge: { source: "person/Joe Bloggs", target: "company/Widget Factory", type: "worksAt", beginning: worksAtWidgetFactoryBeginning, ending: worksAtWidgetFactoryEnding } },
            { edge: { source: "job/Software Developer", target: "skill/Agile", type: "mayRequire" } }
        ])

        // verify the generated create SQL
        expect(joeBloggsGraph.preview()).toBe(linetrim`
            BEGIN TRANSACTION;

            INSERT INTO nodes VALUES (:0), (:1), (:2), (:3), (:4), (:5), (:6);
            INSERT INTO edges VALUES (:7), (:8), (:9), (:10), (:11), (:12);

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
        const joeBloggsFound = await find.person().one("Joe Bloggs")
        expect(joeBloggsFound).toEqual({
            id: "person/Joe Bloggs",
            type: "person"
        })
        // ...and check it's Joe Bloggs when we take the "first" person
        expect(await find.person().one()).toEqual(joeBloggsFound)
        // ...and check it's [Joe Bloggs] when we take all persons
        expect(await find.person().many()).toEqual([joeBloggsFound])

        // there are 2 companies
        expect((await find.company().many()).length).toBe(2)
    })
})