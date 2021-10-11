import { ltrbtrim } from "@src/index"
import { compile } from "./sparql"

describe("sparql", () => {
    describe("parse examples", () => {
        test(ltrbtrim`
            SELECT ?x
            WHERE { ?x  "<http://www.w3.org/2001/vcard-rdf/3.0#FN>"  "John Smith" }
        `, () => {
            const query = ltrbtrim`
                SELECT ?x
                WHERE { ?x  "<http://www.w3.org/2001/vcard-rdf/3.0#FN>"  "John Smith" }
            `
            const result = compile(query)
            expect(result).toBe(ltrbtrim`
                WITH RECURSIVE traverse(subject, predicate, object) AS (
                    SELECT null, null, id FROM vertices
                    WHERE name = :object
                    UNION
                    SELECT source, id, target FROM edges
                    JOIN traverse ON target = object
                    WHERE name = :predicate
                    UNION
                    SELECT id, null, null FROM vertices
                    JOIN traverse ON id = subject
                ) SELECT subject FROM traverse LIMIT -1 OFFSET 2
            `)
        })
    })
})