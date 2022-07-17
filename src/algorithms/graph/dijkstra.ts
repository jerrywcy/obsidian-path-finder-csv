import { Heap } from 'heap-js';
import type { ExtendedGraph } from 'src/algorithms/graph/types';

class Vertice {
    constructor(id: number, dis: number) {
        this.id = id;
        this.dis = dis;
    }
    id: number;
    dis: number;
}

/**
 * 
 * @param source The source node in the graph.
 * @param graph The graph to run dijkstra on.
 * @param forbiddenNodes Nodes that are forbidden and should be seen as not existed.
 * @param forbiddenEdges Nodes that are forbidden and should be seen as not existed.
 * @returns 
 * dis[u]: the length of the shortest path from `source` to node `u`.
 * 
 * from[u]: the node before `u` on the shortest path from `source` to `u`;
 */
export function dijkstra(source: number, graph: ExtendedGraph, forbiddenNodes?: Map<number, boolean>, forbiddenEdges?: Map<string, boolean>): { dis: Array<number>, from: Array<number> } {
    let dis: Array<number> = [];
    let from: Array<number> = [];
    let mk: Array<boolean> = [];
    let n = graph.getN();
    for (let i = 0; i <= n; i++) { dis.push(Infinity); from.push(-1); mk.push(false); }

    from[source] = 0;
    dis[source] = 0;
    let q = new Heap<Vertice>((a: Vertice, b: Vertice) => a.dis - b.dis);
    q.push(new Vertice(source, 0));
    while (!q.isEmpty()) {
        while (!q.isEmpty() &&
            (dis[(q.peek() as Vertice).id] != (q.peek() as Vertice).dis ||
                mk[(q.peek() as Vertice).id])) {
            q.pop();
        }
        if (q.isEmpty()) break;
        let { id: u } = q.pop() as Vertice;
        mk[u] = true;
        for (let { v, w } of graph.getOutEdges(u)) {
            if (forbiddenNodes !== undefined &&
                forbiddenNodes.get(v))
                continue;
            if (forbiddenEdges !== undefined &&
                (forbiddenEdges.get(`${u},${v}`) || forbiddenEdges.get(`${v},${u}`)))
                continue;
            if (!mk[v] && dis[u] + w < dis[v]) {
                dis[v] = dis[u] + w;
                from[v] = u;
                q.push(new Vertice(v, dis[v]));
            }
        }
    }
    return { dis, from };
}