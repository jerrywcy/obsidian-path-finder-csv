import { ItemView, Notice, setIcon, TFile, WorkspaceLeaf } from "obsidian";

import { ExtendedGraph } from 'src/algorithms/graph/types';
import { getNextPath } from "./algorithms/graph/GetNextPath.js";
import { D3ForceGraphLink, D3ForceGraphNode, ForceGraphWithLabels } from './ui/D3ForceGraphWithLabels';

export const VIEW_TYPE_PATHGRAPHVIEW = "path-graph-csv-view";
export const VIEW_TYPE_PATHVIEW = "path-csv-view"

export class PathGraphView extends ItemView {
    source: number;
    target: number;
    generatedFromCSV: boolean;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE_PATHGRAPHVIEW;
    }

    getDisplayText() {
        return "Path Graph view";
    }

    onResize(): void {
        const container = this.containerEl.children[1];
        const svg = container.getElementsByClassName("path-finder path-graph")[0];
        svg.setAttribute("height", container.clientHeight.toString());
        svg.setAttribute("width", container.clientWidth.toString());
    }

    /**
     * Get all nodes in a given graph.
     * @param graph The graph.
     * @returns An array of objects, each representing one node. {id: any, group: "source" | "target" | "node"}
     */
    getNodes(graph: ExtendedGraph): D3ForceGraphNode[] {
        let ret: D3ForceGraphNode[] = [];
        for (let i = 1; i <= graph.getN(); i++) {
            console.log(i,graph.getName(i));
            ret.push({
                id: graph.getName(i),
                group: i === this.source
                    ? "source"
                    : i === this.target
                        ? "target"
                        : "node"
            });
        }
        return ret;
    }

    /**
     * Get all links in a given graph.
     * @param graph The graph.
     * @returns An array of objects, each representing one link. 
     */
    getLinks(graph: ExtendedGraph): D3ForceGraphLink[] {
        let ret: D3ForceGraphLink[] = [];
        for (let i = 1; i <= graph.getM(); i++) {
            let from = graph.getName(graph.edges[i].u), to = graph.getName(graph.edges[i].v);
            if (!from || !to) continue;
            if (this.generatedFromCSV){
                let u=graph.getID(from),v=graph.getID(to);
                let tmp={
                    source: from,
                    target: to,
                    type:
                        graph.edgeID.get(`${v},${u}`)
                            ? "bidirectional"
                            : "monodirectional"
                }
                ret.push(tmp);
            }
            else {
                let resolvedLinks = app.metadataCache.resolvedLinks;
                if (resolvedLinks[from][to]) {
                    let tmp = {
                        source: from,
                        target: to,
                        type:
                            resolvedLinks[to][from]
                                ? "bidirectional"
                                : "monodirectional"
                    };
                    ret.push(tmp);
                }
            }
        }
        return ret;
    }


    /**
     * Set data for the view.
     * @param from The file to start from.
     * @param to The file to end with.
     * @param length The maximum length of all paths shown.
     * @param graph The graph.
     */
    setData(from: any, to: any, length: number, graph: ExtendedGraph, generatedFromCSV: boolean = false) {
        const container = this.containerEl.children[1];
        container.empty();

        let newGraph = new ExtendedGraph();
        newGraph.addVertice(from);
        newGraph.addVertice(to);
        let source = newGraph.getID(from);
        let target = newGraph.getID(to);
        this.source = source; this.target = target; this.generatedFromCSV=generatedFromCSV;
        ForceGraphWithLabels(
            container,
            getNextPath(graph.getID(from), graph.getID(to), length, graph),
            {
                graph: newGraph,
                getNodes: this.getNodes.bind(this),
                getLinks: this.getLinks.bind(this)
            },
            {
                nodeGroup: (x: any) => {
                    return x.group;
                },
                nodeGroups: ["source", "target", "node"],
                colors: ["#227d51", "#cb1b45", "#0b1013"],
                nodeRadius: 10,
                linkGroups: ["monodirectional", "bidirectional"],
                nodeTitle: (x: any) => {
                    // console.log(x);
                    // let file = app.vault.getAbstractFileByPath(x.id);
                    // if (!file) return "undefined";
                    // else if (file instanceof TFile) {
                    //     if (file.extension == "md")
                    //         return file.basename;
                    //     else {
                    //         return file.name;
                    //     }
                    // }
                    // else {
                    //     return file.name;
                    // }
                    return x.id;
                }
            });
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
    }

    async onClose() {
    }
}

export class PathView extends ItemView {
    source: number;
    target: number;
    nextPath: AsyncGenerator<Array<any> | undefined>;
    paths: Array<Array<any>>;
    currentPage: number;
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE_PATHVIEW;
    }

    getDisplayText() {
        return "Path view";
    }

    /**
     * Set data for current View.
     * @param source The source node.
     * @param target The target node.
     * @param length The maximum length of all paths shown.
     * @param graph The graph.
     * @returns 
     */
    async setData(source: number, target: number, length: number, graph: ExtendedGraph) {
        this.source = source; this.target = target; this.nextPath = getNextPath(source, target, length, graph);
        this.currentPage = 0;
        let x = await this.nextPath.next();
        if (!x.value) {
            new Notice("No return from getNext!");
            return;
        }
        this.paths = [x.value];
        this.refresh();
    }

    /**
     * Used to update content when {this.paths} or {this.currentPage} has changed.
     * @param pathTitleContainer the container containing title
     * @param pathContentContainer the container containing content
     * @returns 
     */
    update(pathTitleContainer: HTMLDivElement, pathContentContainer: HTMLDivElement) {
        pathTitleContainer.empty();
        pathContentContainer.empty();
        pathTitleContainer.createEl("h1", { text: `${this.currentPage + 1}/${this.paths.length}` });
        if (this.currentPage >= this.paths.length) return;
        for (let x of this.paths[this.currentPage]) {
            let file = app.vault.getAbstractFileByPath(x);
            if (file === undefined) continue;
            let pathItemContainer = pathContentContainer.createDiv();
            pathItemContainer.addClasses(["path-finder", "panel-display", "path-item"]);
            pathItemContainer.createEl("h3", { text: file instanceof TFile ? file.basename : file.name });
            pathItemContainer.createEl("p", { text: file.path });
        }
    }

    /**
     * The function used to construct basic elements for the view.
     */
    refresh() {
        this.currentPage = 0;
        const container = this.containerEl.children[1];
        container.empty();
        container.setAttribute("style", "padding: 0px");

        const leftButtonContainer = container.createDiv();
        leftButtonContainer.addClasses(["path-finder", "left-button-container"]);
        const pathContainer = container.createDiv();
        pathContainer.addClasses(["path-finder", "path-container"]);
        const pathTitleContainer = pathContainer.createDiv();
        pathTitleContainer.addClasses(["path-finder", "path-container", "title-container"]);
        const pathContentContainer = pathContainer.createDiv();
        pathContentContainer.addClasses(["path-finder", "path-container", "content-container"]);
        const rightButtonContainer = container.createDiv();
        rightButtonContainer.addClasses(["path-finder", "right-button-container"])

        this.update(pathTitleContainer, pathContentContainer);

        const leftButton = leftButtonContainer.createEl("button");
        leftButton.addClasses(["path-finder", "left-button-container", "left-button"]);
        setIcon(leftButton, "left-arrow");
        leftButton.onClickEvent((evt) => {
            if (this.currentPage > 0) {
                this.currentPage--;
            }
            this.update(pathTitleContainer, pathContentContainer);
        })

        const rightButton = rightButtonContainer.createEl("button");
        rightButton.addClasses(["path-finder", "right-button-container", "right-button"]);
        setIcon(rightButton, "right-arrow");
        rightButton.onClickEvent(async (evt) => {
            if (this.currentPage < this.paths.length - 1) {
                this.currentPage++;
            }
            else {
                let res = await this.nextPath.next();
                if (res.value) {
                    this.paths.push(res.value);
                    this.currentPage++;
                }
                else {
                    new Notice("No more Paths!");
                }
            }
            this.update(pathTitleContainer, pathContentContainer);
        })
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
    }

    async onClose() {
    }
}
