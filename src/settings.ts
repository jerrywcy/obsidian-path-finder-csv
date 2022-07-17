import { App, PluginSettingTab, Setting } from "obsidian";
import PathFinderCSVPlugin from "src/main";


export interface PathFinderCSVPluginSettings{
    graphDataPath: string;
}

export const DEFAULT_SETTINGS: PathFinderCSVPluginSettings={
    graphDataPath:"",
}

export class PathFinderCSVPluginSettingTab extends PluginSettingTab{
    plugin: PathFinderCSVPlugin;

    constructor(app: App, plugin: PathFinderCSVPlugin){
        super(app,plugin);
        this.plugin=plugin;
    }

    display(): void{
        let {containerEl}=this;
        containerEl.empty();

        new Setting(containerEl)
            .setName("Graph Data Path")
            .setDesc("The csv to provide data for Graph. Set empty to use vault file links to generate graph.")
            .addText((text) => {
                text
                    .setValue(this.plugin.settings.graphDataPath)
                    .onChange(async (path) => {
                        this.plugin.settings.graphDataPath=path;
                        await this.plugin.saveSettings();
                    });
            })
    }
}