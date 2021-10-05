# Utilities

## Structural Audit

### Rational

Enabled developers to reconcile DSL expections with data reality.

### Abstract

Perform a cross audit of a given DSL against data to identify Hidden Structure and Superflous Structure.

Hidden Structures can be:
1. Vertex Types that are not available in a DSL
2. Edge Types that are no available in a DSL
3. Edge to Vertex relationships that are not constructable in a DSL

Superflous Structures can be:
1. DSL Vertex Types that do not exist in data
2. DSL Edge Types that do not exist in data
3. DSL Vertex to Edge and Edge to Vertex relationships that do not exist in data

### Example

Given the DSL: 

```
person->>hasTheJob->job->isPerformedBy->>person
job->>isFulfilledAt->company->hasJob->>job
```

And the data:

```
{ node: { type:person, id:p } }
{ node: { type:company, id:c } }
{ edge: { source:p, target:c, type:worksAt } }
```

Expect:
1. Inconsistent Structure: `person->>worksAt->company` exists in data but is missing from the DSL
2. Inconsistent Structure: `person->>hasTheJob->job->isPerformedBy->>person` exists in the DSL but is missing from the data
3. Inconsistent Structure: `job->>isFulfilledAt->company->hasJob->>job` exists in the DSL but is missing from the data

## DSL Adviser

### Rational

Provide instruction for developers on how to resolve Structural Audit inconsistencies.

### Abstract

Given the output of the Structural Audit process, provide meaningful resolutions.

### Example

Given:    
_Inconsistent Structure: `person->>worksAt->company` exists in data but is missing from the DSL_

Expect:

<pre>
Add a worksAt edge to person that targets `company`:

const resolution_person = nodeType("person", (withEdge, p) => ({ 
    worksAt: (_c: EdgeType&lt;typeof company&gt;) => withEdge({ 
        type: "worksAt", source: `person/${p}`, type: _c.vertex.id 
    })
}))
</pre>

WIP WIP WIP WIP WIP WIP 