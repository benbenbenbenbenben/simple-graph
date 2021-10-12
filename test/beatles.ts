import { createDb } from "@src/index";
import { tripleStore } from "@src/design/triple";

tripleStore(createDb()).then(({ insert }) => {
    insert(
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
})