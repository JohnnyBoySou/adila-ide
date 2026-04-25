export namespace main {
	
	export class CmdFileEntry {
	    name: string;
	    path: string;
	    isDirectory: boolean;
	    mtime?: number;
	
	    static createFrom(source: any = {}) {
	        return new CmdFileEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.isDirectory = source["isDirectory"];
	        this.mtime = source["mtime"];
	    }
	}
	export class DeviceFlowStart {
	    userCode: string;
	    verificationUri: string;
	    deviceCode: string;
	    interval: number;
	    expiresIn: number;
	
	    static createFrom(source: any = {}) {
	        return new DeviceFlowStart(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.userCode = source["userCode"];
	        this.verificationUri = source["verificationUri"];
	        this.deviceCode = source["deviceCode"];
	        this.interval = source["interval"];
	        this.expiresIn = source["expiresIn"];
	    }
	}
	export class FileEntry {
	    name: string;
	    path: string;
	    isDir: boolean;
	
	    static createFrom(source: any = {}) {
	        return new FileEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.isDir = source["isDir"];
	    }
	}
	export class GitBranch {
	    name: string;
	    current: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GitBranch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.current = source["current"];
	    }
	}
	export class GitChangedFile {
	    path: string;
	    prevPath?: string;
	    status: string;
	    staged: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GitChangedFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.prevPath = source["prevPath"];
	        this.status = source["status"];
	        this.staged = source["staged"];
	    }
	}
	export class GitCommit {
	    hash: string;
	    shortHash: string;
	    message: string;
	    author: string;
	    date: string;
	
	    static createFrom(source: any = {}) {
	        return new GitCommit(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hash = source["hash"];
	        this.shortHash = source["shortHash"];
	        this.message = source["message"];
	        this.author = source["author"];
	        this.date = source["date"];
	    }
	}
	export class GitGraphNode {
	    hash: string;
	    short: string;
	    parents: string[];
	    refs: string[];
	    subject: string;
	    author: string;
	    date: string;
	    ts: number;
	
	    static createFrom(source: any = {}) {
	        return new GitGraphNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hash = source["hash"];
	        this.short = source["short"];
	        this.parents = source["parents"];
	        this.refs = source["refs"];
	        this.subject = source["subject"];
	        this.author = source["author"];
	        this.date = source["date"];
	        this.ts = source["ts"];
	    }
	}
	export class GitHubRepo {
	    name: string;
	    cloneUrl: string;
	    sshUrl: string;
	    htmlUrl: string;
	
	    static createFrom(source: any = {}) {
	        return new GitHubRepo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.cloneUrl = source["cloneUrl"];
	        this.sshUrl = source["sshUrl"];
	        this.htmlUrl = source["htmlUrl"];
	    }
	}
	export class GitHubUser {
	    login: string;
	    name: string;
	    avatarUrl: string;
	
	    static createFrom(source: any = {}) {
	        return new GitHubUser(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.login = source["login"];
	        this.name = source["name"];
	        this.avatarUrl = source["avatarUrl"];
	    }
	}
	export class GitRemote {
	    name: string;
	    url: string;
	
	    static createFrom(source: any = {}) {
	        return new GitRemote(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.url = source["url"];
	    }
	}
	export class GitStash {
	    index: number;
	    message: string;
	    date: string;
	
	    static createFrom(source: any = {}) {
	        return new GitStash(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.index = source["index"];
	        this.message = source["message"];
	        this.date = source["date"];
	    }
	}
	export class LSPServerStatus {
	    lang: string;
	    name: string;
	    installed: boolean;
	    path: string;
	    installHint: string;
	
	    static createFrom(source: any = {}) {
	        return new LSPServerStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.lang = source["lang"];
	        this.name = source["name"];
	        this.installed = source["installed"];
	        this.path = source["path"];
	        this.installHint = source["installHint"];
	    }
	}
	export class PaletteItem {
	    id: string;
	    title: string;
	    description?: string;
	    detail?: string;
	    hint?: string;
	    icon?: string;
	
	    static createFrom(source: any = {}) {
	        return new PaletteItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.detail = source["detail"];
	        this.hint = source["hint"];
	        this.icon = source["icon"];
	    }
	}
	export class ProductInfo {
	    name: string;
	    version: string;
	    goVersion: string;
	    os: string;
	    arch: string;
	    repo: string;
	    issuesUrl: string;
	    licenseUrl: string;
	
	    static createFrom(source: any = {}) {
	        return new ProductInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.version = source["version"];
	        this.goVersion = source["goVersion"];
	        this.os = source["os"];
	        this.arch = source["arch"];
	        this.repo = source["repo"];
	        this.issuesUrl = source["issuesUrl"];
	        this.licenseUrl = source["licenseUrl"];
	    }
	}
	export class SearchMatch {
	    path: string;
	    line: number;
	    column: number;
	    length: number;
	    preview: string;
	
	    static createFrom(source: any = {}) {
	        return new SearchMatch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.line = source["line"];
	        this.column = source["column"];
	        this.length = source["length"];
	        this.preview = source["preview"];
	    }
	}
	export class SearchOptions {
	    query: string;
	    caseSensitive: boolean;
	    wholeWord: boolean;
	    regex: boolean;
	    maxResults: number;
	
	    static createFrom(source: any = {}) {
	        return new SearchOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.query = source["query"];
	        this.caseSensitive = source["caseSensitive"];
	        this.wholeWord = source["wholeWord"];
	        this.regex = source["regex"];
	        this.maxResults = source["maxResults"];
	    }
	}
	export class SessionInfo {
	    id: string;
	    pid: number;
	    shell: string;
	    cwd: string;
	    cols: number;
	    rows: number;
	    startedAt: number;
	    running: boolean;
	    exitCode: number;
	
	    static createFrom(source: any = {}) {
	        return new SessionInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.pid = source["pid"];
	        this.shell = source["shell"];
	        this.cwd = source["cwd"];
	        this.cols = source["cols"];
	        this.rows = source["rows"];
	        this.startedAt = source["startedAt"];
	        this.running = source["running"];
	        this.exitCode = source["exitCode"];
	    }
	}
	export class ShellInfo {
	    path: string;
	    name: string;
	    avail: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ShellInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.avail = source["avail"];
	    }
	}
	export class StartOptions {
	    cwd: string;
	    shell: string;
	    args: string[];
	    env: Record<string, string>;
	    cols: number;
	    rows: number;
	
	    static createFrom(source: any = {}) {
	        return new StartOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cwd = source["cwd"];
	        this.shell = source["shell"];
	        this.args = source["args"];
	        this.env = source["env"];
	        this.cols = source["cols"];
	        this.rows = source["rows"];
	    }
	}

}

