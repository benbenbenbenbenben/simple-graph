import { Tibu } from "tibu"
import { ltrbtrim } from ".."
const { rule, all, either, flat, many, optional, parse, token } = Tibu

export const compile = (sparql: string) => {
    return ltrbtrim`
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
    `
}