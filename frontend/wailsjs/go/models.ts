export namespace main {
	
	export class BenchHistoryFile {
	    name: string;
	    kind: string;
	    format: string;
	    size: number;
	    modUnix: number;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new BenchHistoryFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.kind = source["kind"];
	        this.format = source["format"];
	        this.size = source["size"];
	        this.modUnix = source["modUnix"];
	        this.path = source["path"];
	    }
	}
	export class BenchOp {
	    name: string;
	    count: number;
	    totalNs: number;
	    meanNs: number;
	    minNs: number;
	    maxNs: number;
	    p50Ns: number;
	    p95Ns: number;
	    p99Ns: number;
	    lastNs: number;
	    lastUnix: number;
	
	    static createFrom(source: any = {}) {
	        return new BenchOp(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.count = source["count"];
	        this.totalNs = source["totalNs"];
	        this.meanNs = source["meanNs"];
	        this.minNs = source["minNs"];
	        this.maxNs = source["maxNs"];
	        this.p50Ns = source["p50Ns"];
	        this.p95Ns = source["p95Ns"];
	        this.p99Ns = source["p99Ns"];
	        this.lastNs = source["lastNs"];
	        this.lastUnix = source["lastUnix"];
	    }
	}
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
	export class ConfigQuery {
	    key: string;
	    defaultValue: any;
	
	    static createFrom(source: any = {}) {
	        return new ConfigQuery(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.defaultValue = source["defaultValue"];
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
	export class GitHubEvent {
	    id: string;
	    type: string;
	    repoName: string;
	    repoUrl: string;
	    createdAt: string;
	    action: string;
	    ref: string;
	    title: string;
	    number: number;
	    url: string;
	
	    static createFrom(source: any = {}) {
	        return new GitHubEvent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.repoName = source["repoName"];
	        this.repoUrl = source["repoUrl"];
	        this.createdAt = source["createdAt"];
	        this.action = source["action"];
	        this.ref = source["ref"];
	        this.title = source["title"];
	        this.number = source["number"];
	        this.url = source["url"];
	    }
	}
	export class GitHubNotification {
	    id: string;
	    reason: string;
	    unread: boolean;
	    updatedAt: string;
	    title: string;
	    type: string;
	    url: string;
	    htmlUrl: string;
	    repoName: string;
	    repoFull: string;
	    repoAvatar: string;
	
	    static createFrom(source: any = {}) {
	        return new GitHubNotification(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.reason = source["reason"];
	        this.unread = source["unread"];
	        this.updatedAt = source["updatedAt"];
	        this.title = source["title"];
	        this.type = source["type"];
	        this.url = source["url"];
	        this.htmlUrl = source["htmlUrl"];
	        this.repoName = source["repoName"];
	        this.repoFull = source["repoFull"];
	        this.repoAvatar = source["repoAvatar"];
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
	    bio: string;
	    company: string;
	    location: string;
	    blog: string;
	    email: string;
	    htmlUrl: string;
	    publicRepos: number;
	    followers: number;
	    following: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new GitHubUser(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.login = source["login"];
	        this.name = source["name"];
	        this.avatarUrl = source["avatarUrl"];
	        this.bio = source["bio"];
	        this.company = source["company"];
	        this.location = source["location"];
	        this.blog = source["blog"];
	        this.email = source["email"];
	        this.htmlUrl = source["htmlUrl"];
	        this.publicRepos = source["publicRepos"];
	        this.followers = source["followers"];
	        this.following = source["following"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class GitHubUserRepo {
	    name: string;
	    fullName: string;
	    description: string;
	    htmlUrl: string;
	    cloneUrl: string;
	    language: string;
	    stars: number;
	    forks: number;
	    watchers: number;
	    updatedAt: string;
	    private: boolean;
	    fork: boolean;
	    archived: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GitHubUserRepo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.fullName = source["fullName"];
	        this.description = source["description"];
	        this.htmlUrl = source["htmlUrl"];
	        this.cloneUrl = source["cloneUrl"];
	        this.language = source["language"];
	        this.stars = source["stars"];
	        this.forks = source["forks"];
	        this.watchers = source["watchers"];
	        this.updatedAt = source["updatedAt"];
	        this.private = source["private"];
	        this.fork = source["fork"];
	        this.archived = source["archived"];
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
	export class LinearProject {
	    id: string;
	    name: string;
	    color: string;
	
	    static createFrom(source: any = {}) {
	        return new LinearProject(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.color = source["color"];
	    }
	}
	export class LinearTeam {
	    id: string;
	    name: string;
	    key: string;
	
	    static createFrom(source: any = {}) {
	        return new LinearTeam(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.key = source["key"];
	    }
	}
	export class LinearState {
	    id: string;
	    name: string;
	    color: string;
	    type: string;
	
	    static createFrom(source: any = {}) {
	        return new LinearState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.color = source["color"];
	        this.type = source["type"];
	    }
	}
	export class LinearIssue {
	    id: string;
	    identifier: string;
	    title: string;
	    priority: number;
	    url: string;
	    createdAt: string;
	    updatedAt: string;
	    dueDate: string;
	    state: LinearState;
	    team: LinearTeam;
	    project?: LinearProject;
	
	    static createFrom(source: any = {}) {
	        return new LinearIssue(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.identifier = source["identifier"];
	        this.title = source["title"];
	        this.priority = source["priority"];
	        this.url = source["url"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	        this.dueDate = source["dueDate"];
	        this.state = this.convertValues(source["state"], LinearState);
	        this.team = this.convertValues(source["team"], LinearTeam);
	        this.project = this.convertValues(source["project"], LinearProject);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	export class LinearUser {
	    id: string;
	    name: string;
	    email: string;
	    avatarUrl: string;
	    displayName: string;
	
	    static createFrom(source: any = {}) {
	        return new LinearUser(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.email = source["email"];
	        this.avatarUrl = source["avatarUrl"];
	        this.displayName = source["displayName"];
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
	export class SpotifyAuthStatus {
	    connected: boolean;
	    expired: boolean;
	    expiresAt: number;
	
	    static createFrom(source: any = {}) {
	        return new SpotifyAuthStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connected = source["connected"];
	        this.expired = source["expired"];
	        this.expiresAt = source["expiresAt"];
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
	export class TaskDef {
	    id: string;
	    kind: string;
	    label: string;
	    detail: string;
	    command: string;
	    cwd: string;
	    source: string;
	
	    static createFrom(source: any = {}) {
	        return new TaskDef(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.kind = source["kind"];
	        this.label = source["label"];
	        this.detail = source["detail"];
	        this.command = source["command"];
	        this.cwd = source["cwd"];
	        this.source = source["source"];
	    }
	}
	export class WorkspaceConfig {
	
	
	    static createFrom(source: any = {}) {
	        return new WorkspaceConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}

}

