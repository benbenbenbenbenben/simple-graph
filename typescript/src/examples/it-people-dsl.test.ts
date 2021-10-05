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
        const joeBloggsGraph = create($ => {
            // company
            const AcmeInc = $.company("Acme Inc.")
            // skills
            const TypeScript = $.skill("TypeScript")
            const Python = $.skill("Python")
            const AgileMethodologies = $.skill("Agile")
            // occupation
            const SoftwareDeveloper = $.occupation("Software Developer")
            // person
            const JoeBloggs = $.person("Joe Bloggs")
            const { that: JoeBloggsIsAPersonThat } = JoeBloggs

            // the "as" operation is an example of an edge-like API that adds complex edges opaquely
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
        expect(joeBloggsGraph.createOutput).toEqual([
            // vertices
            { vertex: { id: "company/Acme Inc.", name: "Acme Inc.", type: "company" } },
            { vertex: { id: "skill/TypeScript", name: "TypeScript", type: "skill" } },
            { vertex: { id: "skill/Python", name: "Python", type: "skill" } },
            { vertex: { id: "skill/Agile", name: "Agile", type: "skill" } },
            { vertex: { id: "occupation/Software Developer", name: "Software Developer", type: "occupation" } },
            { vertex: { id: "person/Joe Bloggs", name: "Joe Bloggs", type: "person" } },
            // edges
            { edge: { source: "person/Joe Bloggs", target: "company/Acme Inc.", type: "worksAt", beginning: worksAtAcmeBeginning } },
            // these records are created by 'as' on the 'worksAt' API
            { vertex: { id: "job/#-368659788", name: "Software Developer", type: "job", level: "senior" } },
            { edge: { source: "occupation/Software Developer", target: "job/#-368659788", type: "includesJob" } },
            { edge: { source: "person/Joe Bloggs", target: "job/#-368659788", type: "hasJob" } },
            { edge: { source: "person/Joe Bloggs", target: "occupation/Software Developer", type: "worksAs" } },
            { edge: { source: "job/#-368659788", target: "company/Acme Inc.", type: "isPerformedFor" } },
            //
            { edge: { source: "person/Joe Bloggs", target: "skill/TypeScript", type: "usesTheSkill" } },
            { edge: { source: "person/Joe Bloggs", target: "skill/Python", type: "usesTheSkill" } },
            { edge: { source: "person/Joe Bloggs", target: "skill/Agile", type: "usesTheSkill" } },
            // extra
            { vertex: { id: "company/Widget Factory", name: "Widget Factory", type: "company" } },
            { edge: { source: "person/Joe Bloggs", target: "company/Widget Factory", type: "worksAt", beginning: worksAtWidgetFactoryBeginning, ending: worksAtWidgetFactoryEnding } },
            { vertex: { id: "job/#1339652452", name: "Software Developer", type: "job", level: "mid" } },
            { edge: { source: "occupation/Software Developer", target: "job/#1339652452", type: "includesJob" } },
            { edge: { source: "person/Joe Bloggs", target: "job/#1339652452", type: "hasJob" } },
            { edge: { source: "job/#1339652452", target: "company/Widget Factory", type: "isPerformedFor" } },
            { edge: { source: "occupation/Software Developer", target: "skill/Agile", type: "mayRequire" } },
        ])

        // verify the generated create SQL
        expect(joeBloggsGraph.preview()).toBe(linetrim`
            BEGIN TRANSACTION;

            INSERT INTO vertices VALUES (:0), (:1), (:2), (:3), (:4), (:5), (:6), (:7), (:8);
            INSERT INTO edges VALUES (:9), (:10), (:11), (:12), (:13), (:14), (:15), (:16), (:17), (:18), (:19), (:20), (:21);

            COMMIT TRANSACTION;
            SELECT 1 as ok;
        `)

        // assert the database is empty
        const count = (await database).raw("SELECT (SELECT count(*) FROM vertices) + (SELECT count(*) FROM edges) as total")[0][0].total
        expect(count).toBe(0)

        // commit the graph (apply it to the database)
        const execution = await joeBloggsGraph.commit()
        expect(execution).toBe(true)

        // find vertex (simple, none traversal)
        const joeBloggsFound = await find.person.one("Joe Bloggs")
        expect(joeBloggsFound).toEqual({
            id: "person/Joe Bloggs",
            name: "Joe Bloggs",
            type: "person"
        })
        // ...and check it's Joe Bloggs when we take the "first" person
        expect(await find.person.one()).toEqual(joeBloggsFound)
        // ...and check it's [Joe Bloggs] when we take all persons
        expect(await find.person.many()).toEqual([joeBloggsFound])

        // there are 2 companies
        expect((await find.company.many()).length).toBe(2)
    })
})