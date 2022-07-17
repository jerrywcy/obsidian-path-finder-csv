// Credits go to phibr0's Obsidian Dictionary Plugin: https://github.com/phibr0/obsidian-dictionary

import { TextInputSuggest } from "./suggest";
import { App, TAbstractFile, TFile } from "obsidian";
import { setIcon } from 'obsidian';

export class SuggestFile {
    constructor(name: string, path: string, origin: boolean) {
        this.name = name;
        this.path = path;
        this.origin = origin;
    }
    name: string;
    path: string;
    origin: boolean;
}

export class GenericTextSuggester extends TextInputSuggest<string> {
    constructor(public app: App, public inputEl: HTMLInputElement | HTMLTextAreaElement, private items: string[]) {
        super(app, inputEl);
    }

    getSuggestions(inputStr: string): string[] {
        const inputLowerCase=inputStr.toLowerCase();
        const filtered = this.items.filter(item => {
            if (item.toLowerCase().contains(inputLowerCase))
                return item;
        });

        if (!filtered) this.close();
        if (filtered?.length > 0) return filtered;
        return [];
    }

    selectSuggestion(item: string): void {
        this.inputEl.value = item;
        this.inputEl.trigger("input");
        this.close();
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        if (value) {
            el.setText(value);
        }
    }
}