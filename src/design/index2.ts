type PropType = number | string | boolean | { [x: string]: PropType }
type Props = {
    [x: string]: PropType | PropType[]
}

type KnownSources = {

}

type KnownTargets = {
    
}


type Vertex<
    Type extends string, 
    Properties extends Props, 
    Sources extends KnownSources = KnownSources,
    Targets extends KnownTargets = KnownTargets,
> = {

}