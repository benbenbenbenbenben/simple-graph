import { createDb } from ".."
import { tripleStore, vertex, edge } from "./triple";

describe("tripleStore", () => {
    let db: ReturnType<typeof createDb>;
    beforeEach(async () => {
        db = createDb()
    })

    describe("insert", () => {
        test("insert a single vertex", async () => {
            const { insert } = await tripleStore(db)
            await insert("hello");
            expect((await db).getVertexById("hello")).toBeDefined()
        })
        test("insert a single vertex twice and throw", async () => {
            const { insert } = await tripleStore(db)
            await insert("hello")
            const error = await insert("hello").catch(e => e.toString())
            expect(error).toEqual("Error: UNIQUE constraint failed: vertices.id")
        })
        test("insert a triple", async () => {
            const { insert } = await tripleStore(db);
            await insert("Bob", ["friendOf", "Alice"])
            expect((await db).getVertexById("Bob")).toBeDefined()
            expect((await db).getEdgeById("Bob:friendOf:Alice")).toBeDefined()
            expect((await db).getVertexById("Alice")).toBeDefined()
        })
    })

    test.only("insert beatles data", async () => {
        const { insert, query } = await tripleStore(db)
        await insert(
            "The_Beatles",
            [
                ["type", "Band"],
                ["name", "The Beatles"],
                ["member", "John_Lennon"],
                ["member", "Paul_McCartney"],
                ["member", "Ringo_Starr"],
                ["member", "George_Harrison"],
            ],
            ["John_Lennon",
                ["type", "SoloArtist"]
            ],
            ["Paul_McCartney",
                ["type", "SoloArtist"],
            ],
            ["Ringo_Starr",
                ["type", "SoloArtist"]
            ],
            ["George_Harrison",
                ["type", "SoloArtist"],
            ],
            ["Please_Please_Me",
                ["type", "Album"],
                ["name", "Please Please Me"],
                ["date", "1963-03-22"],
                ["artist", "The_Beatles"],
                ["track", "Love_Me_Do"],
            ],
            ["Love_Me_Do",
                ["type", "Song"],
                ["name", "Love Me Do"],
                ["length", "125"],
                ["writer", "John_Lennon"],
                ["writer", "Paul McCartney"],
            ],
            ["McCartney",
                ["type", "Album"],
                ["name", "McCartney"],
                ["date", "1970-10-11"],
                ["artist", "Paul_McCartney"],
            ],
            ["Imagine",
                ["type", "Album"],
                ["name", "Imagine"],
                ["date", "1971-10-11"],
                ["artist", "John_Lennon"]
            ]
        )
        const memberOfTheBand = await query(({ val, where }) => {
            const theBeatles = vertex("The_Beatles")
            const hasMember = edge("member")
            const member = val()
            where(
                [theBeatles, hasMember, member]
            ).select([member])
        })
        memberOfTheBand // ?
    })

    afterEach(async () => {
        (await db).close()
    })
})