import { normalizePath, Notice, Plugin, TFile } from 'obsidian';

import { ExtendedGraph } from "src/algorithms/graph/types"
import { PathsCSVModal, PathsFileModal } from './modals';
import { PathGraphView, PathView, VIEW_TYPE_PATHGRAPHVIEW, VIEW_TYPE_PATHVIEW } from './view';
import { dijkstra } from './algorithms/graph/dijkstra';
import { DEFAULT_SETTINGS, PathFinderCSVPluginSettings, PathFinderCSVPluginSettingTab } from './settings';
import { parse } from 'csv';

export default class PathFinderCSVPlugin extends Plugin {
	settings: PathFinderCSVPluginSettings

	async onload() {
		console.log("Loading Path Finder CSV plugin");
		await this.loadSettings();
		this.addSettingTab(new PathFinderCSVPluginSettingTab(this.app,this));

		this.addCommand({
			id: 'find-shortest-path-csv',
			name: 'Find Shortest Path',
			callback: async () => {
				if (this.settings.graphDataPath){
					let csvFile=app.vault.getAbstractFileByPath(this.settings.graphDataPath);
					if (!(csvFile instanceof TFile)){
						new Notice(`Illegal graph data path: ${this.settings.graphDataPath}`);
						return ;
					}
					let csvContent=await app.vault.read(csvFile);
					new PathsCSVModal(this.app, this.findPaths.bind(this, "shortest_path"), "shortest_path", csvContent).open();
				}
				else{
					new PathsFileModal(this.app, this.findPaths.bind(this, "shortest_path"), "shortest_path").open();
				}
			}
		});

		this.addCommand({
			id: 'find-all-paths-as-graph-csv',
			name: 'Find All Path As Graph',
			callback: async () => {
				if (this.settings.graphDataPath){
					let csvFile=app.vault.getAbstractFileByPath(this.settings.graphDataPath);
					if (!(csvFile instanceof TFile)){
						new Notice(`Illegal graph data path: ${this.settings.graphDataPath}`);
						return ;
					}
					let csvContent=await app.vault.read(csvFile);
					new PathsCSVModal(this.app, this.findPaths.bind(this, "all_paths_as_graph"), "all_paths_as_graph", csvContent).open();
				}
				else {
					new PathsFileModal(this.app, this.findPaths.bind(this, "all_paths_as_graph"), "all_paths_as_graph").open();
				}
			}
		});

		this.addCommand({
			id: 'find-all-paths-csv',
			name: 'Find All Path',
			callback: async () => {
				console.log(this.settings.graphDataPath);
				if (this.settings.graphDataPath){
					let csvFile=app.vault.getAbstractFileByPath(this.settings.graphDataPath);
					if (!(csvFile instanceof TFile)){
						new Notice(`Illegal graph data path: ${this.settings.graphDataPath}`);
						return ;
					}
					let csvContent=await app.vault.read(csvFile);
					new PathsCSVModal(this.app, this.findPaths.bind(this, "all_paths"), "all_paths", csvContent).open();
				}
				else {
					new PathsFileModal(this.app, this.findPaths.bind(this, "all_paths"), "all_paths").open();
				}
			}
		});

		this.registerView(
			VIEW_TYPE_PATHGRAPHVIEW,
			(leaf) => new PathGraphView(leaf)
		);

		this.registerView(
			VIEW_TYPE_PATHVIEW,
			(leaf) => new PathView(leaf)
		);
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_PATHGRAPHVIEW);
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_PATHVIEW);
	}
	/**
	 * Load settings
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * Save settings
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Find paths and show them in new view according to `operation`.
	 * @param operation Pass "shortest_path" to find the shortest paths between `from` and `to` and show them as graph. 
	 * 
	 * Pass "all_paths_as_graph" to find all paths between `from` and `to` and show them as graph.
	 * 
	 * Pass "all_paths" to find all paths between `from` and `to` and show them as text. 
	 * @param from The file to start from.
	 * @param to The file to end with.
	 * @param length The maximum length of all paths shown. Useless if `operation`==="shortest_path".
	 */
	async findPaths(operation: "shortest_path" | "all_paths_as_graph" | "all_paths", from: string, to: string, length?: number) {
		from = normalizePath(from);
		to = normalizePath(to);
		let { vault } = app;
		let { adapter } = vault;

		if (!adapter.exists(from)) {
			new Notice(`${from} path does not exist.`);
			return;
		}
		if (!adapter.exists(to)) {
			new Notice(`${to} path does not exist.`);
			return;
		}

		let graph = await this.buildGraph();

		let source = graph.getID(from);
		let target = graph.getID(to);
		if (source === undefined) {
			new Notice(`${from} does not exist!`);
			return;
		}
		if (target === undefined) {
			new Notice(`${to} does not exist!`);
			return;
		}
		let { dis } = dijkstra(source, graph);
		if (from === to) {
			new Notice(`${from} and ${to} are the same file!`);
			return;
		}
		if (dis[target] === Infinity) {
			new Notice(`${from} has no path that lead to ${to}.`);
			return;
		}
		if (operation == "shortest_path") {
			this.openPathGraphView(from, to, dis[target], graph);
		}
		else if (operation == "all_paths_as_graph") {
			this.openPathGraphView(from, to, length, graph);
		}
		else if (operation == "all_paths") {
			this.openPathView(from, to, length, graph);
		}
	}

	/**
	 * Get the graph formed by all notes in the vault.
	 * @returns The graph formed by all notes in the vault.
	 */
	async buildGraph(): Promise<ExtendedGraph> {
		let graph = new ExtendedGraph();
		if (this.settings.graphDataPath){
			let csvFile=app.vault.getAbstractFileByPath(this.settings.graphDataPath);
			if (!(csvFile instanceof TFile)){
				new Notice(`Illegal graph data path: ${this.settings.graphDataPath}`);
				return new ExtendedGraph();
			}
			let csvContent=await app.vault.read(csvFile);
			let parser=parse(csvContent);
			for await (let record of parser){
				let u=record[0];
				let v=record[1];
				let w=parseInt(record[2]);
				if (!(record instanceof Array) || 
					(typeof u)!=="string" || 
					(typeof v)!=="string" || 
					(isNaN(w) || w<0)){
					new Notice(`Wrong CSV Format: ${record}`);
					return new ExtendedGraph();
				}
				graph.addEdgeExtended(u,v,w);
				console.log(u,v,w);
			}
		}
		else{
			let { resolvedLinks } = app.metadataCache;
			for (let fromFilePath in resolvedLinks) {
				for (let toFilePath in resolvedLinks[fromFilePath]) {
					graph.addEdgeExtended(fromFilePath, toFilePath, 1);
					graph.addEdgeExtended(toFilePath, fromFilePath, 1);
				}
			}
		}
		return graph;
	}

	/**
	 * Show all paths no longer than `length` from `source` to `target` in a newly opened view as graph.
	 * @param from The node to start from.
	 * @param to The node to end with.
	 * @param length The maximum length of all paths shown.
	 * @param graph The graph.
	 */
	async openPathGraphView(from: any, to: any, length: number, graph: ExtendedGraph) {
		let { workspace } = app;
		workspace.detachLeavesOfType(VIEW_TYPE_PATHGRAPHVIEW);

		await workspace.getLeaf(true).setViewState({
			type: VIEW_TYPE_PATHGRAPHVIEW,
			active: true,
		});

		let pathGraphViewLeaf = workspace.getLeavesOfType(VIEW_TYPE_PATHGRAPHVIEW)[0];
		let pathGraphView = pathGraphViewLeaf.view;
		if (!(pathGraphView instanceof PathGraphView)) {
			new Notice("Failed to open Path View. Please try again.")
			pathGraphViewLeaf.detach();
			return;
		}
		pathGraphView.setData(from, to, length, graph, this.settings.graphDataPath!=="" && this.settings.graphDataPath!==undefined);

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(VIEW_TYPE_PATHGRAPHVIEW)[0]
		);
	}


	/**
	 * Show all paths no longer than `length` from `source` to `target` in a newly opened view as text.
	 * @param from The node to start from.
	 * @param to The node to end with.
	 * @param length The maximum length of all paths shown.
	 * @param graph The graph.
	 */
	async openPathView(from: any, to: any, length: number, graph: ExtendedGraph) {
		let source = graph.getID(from), target = graph.getID(to);
		if (source === undefined) {
			new Notice(`${from} does note exist!`);
			return;
		}
		if (target === undefined) {
			new Notice(`${to} does note exist!`);
			return;
		}
		let { workspace } = app;
		workspace.detachLeavesOfType(VIEW_TYPE_PATHVIEW);

		await workspace.getLeaf(true).setViewState({
			type: VIEW_TYPE_PATHVIEW,
			active: true,
		});

		let pathViewLeaf = workspace.getLeavesOfType(VIEW_TYPE_PATHVIEW)[0];
		let pathView = pathViewLeaf.view;
		if (!(pathView instanceof PathView)) {
			new Notice("Failed to open Path View. Please try again.")
			pathViewLeaf.detach();
			return;
		}
		pathView.setData(source, target, length, graph);

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(VIEW_TYPE_PATHVIEW)[0]
		);
	}
}
