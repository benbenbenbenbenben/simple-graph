# Novel Graphic

Novel Graphic is a serverless graph database with a DSL for building strongly typed graphs.

It ships with a SQLite driver and uses [sql.js](https://github.com/sql-js/sql.js/). It can be made to target other SQL databases by writing a driver as well as probably any other kind of storage, locally or remotely.

Because it doesn't depend on database servers, it happily runs in both the browser or node.js without any additional dependencies.

# Jump In

## 1. Design a Domain

```TypeScript
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


export const foss = dsl({
    person,
    openSourceProject
})(createDb())

```

## 2. Use a Domain

```TypeScript
create($ => 
  $.openSourceProject(
      "Novel Graphic" {
        by: "Benjamin Babik" }
    ).isA(
      "Graph Database"
    ).that.isForkedFrom(
      "simple-graph", { 
        by: "Denis Papathanasiou",
        www: "https://github.com/dpapathanasiou/simple-graph" }
    ).and.isInspiredBy(
      { "SQLite as a document database": { 
        www: "https://dgl.cx/2020/06/sqlite-json-support" } },
      { "JanusGraph": {
        www: "https://janusgraph.org/" } }
    )
).commit()
```

# Usage

## Node.js

Install it.

`yarn add novelgraphic`

Design your graph.

```TypeScript
import { vertex } from "novelgraphic/design"

const person = vertex("person")
const company = vertex("company")
const skill = vertex("skill")
const occupation = addVertex("occupation", ({ $edge }, occupationName) => ({
    that: {
        mayRequire: (_skill: EdgeType<typeof skill>) => $edge({
            type: "mayRequire",
            source: `occupation/${occupationName}`,
            target: _skill.vertex.id
        })
    }
}))
```

Use a graph