import {
  ReplaceInFiles,
  SearchInFiles,
} from "../../../wailsjs/go/main/App";
import type { main } from "../../../wailsjs/go/models";

export type SearchOptions = main.SearchOptions;
export type SearchMatch = main.SearchMatch;

export const searchRpc = {
  search(rootPath: string, opts: SearchOptions): Promise<SearchMatch[]> {
    return SearchInFiles(rootPath, opts) as unknown as Promise<SearchMatch[]>;
  },
  replace(rootPath: string, opts: SearchOptions, replacement: string): Promise<number> {
    return ReplaceInFiles(rootPath, opts, replacement) as unknown as Promise<number>;
  },
};
