import { dsl, vertex } from "@src/design/index"
import { createDb } from "@src/index"

const person = vertex("person")
    .withFields<{
        name: string
    }>()

const openSourceProject = vertex("foss-project")
    .withFields<{
        authoredBy: string[]
    }>()
    .andApi(
        ({ $push, $id }) => {
            const andIsA = {
                isA: (typeOfProject: string) => {
                    $push({
                        edge: {
                            source: $id,
                            type: "isTypeOf",
                            target: `software-category/${typeOfProject}`
                        }
                    })
                    const that = {
                        isForkedFrom: (aParentProject: string, { by, www }: { by: string, www: string }) => {
                            $push({
                                vertex: {
                                    id: `foss-project/${aParentProject}`,
                                    type: `foss-project`,
                                    by,
                                    www,
                                }
                            })
                            $push({
                                edge: {
                                    source: $id,
                                    type: "isForkOf",
                                    target: `foss-project/${aParentProject}`
                                }
                            })
                            return { and: { ...that, ...andIsA } }
                        },
                        isInspiredBy: (someWebpages: Record<string, { www: string }>) => {
                            for (const webpageTitle in someWebpages) {
                                $push({
                                    vertex: {
                                        type: `webpage`,
                                        id: `webpage/${webpageTitle}`,
                                        title: webpageTitle,
                                        url: someWebpages[webpageTitle].www
                                    }
                                })
                                $push({
                                    edge: {
                                        source: $id,
                                        type: "isInspiredBy",
                                        target: `webpage/${webpageTitle}`,
                                    }
                                })
                            }
                            return { and: { ...that, ...andIsA } }
                        }
                    }
                    return { that }
                }
            }
            return andIsA
        }
    )


const foss = dsl({
    person,
    openSourceProject
})(createDb())

foss.create($ => {
    $.openSourceProject(
        "Novel Graphic", {
        authoredBy: ["Benjamin Babik"]
    }).isA(
        "Graph Database"
    ).that.isForkedFrom(
        "simple-graph", {
        by: "Denis Papathanasiou",
        www: "https://github.com/dpapathanasiou/simple-graph"
    }).and.isInspiredBy({
        "SQLite as a document database": {
            www: "https://dgl.cx/2020/06/sqlite-json-support"
        },
        "JanusGraph": {
            www: "https://janusgraph.org/"
        }
    })
})