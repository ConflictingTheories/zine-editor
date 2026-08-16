const headersFor = token => token ? { Authorization: `Bearer ${token}` } : {}
const parse = async response => { if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `HTTP ${response.status}`); return response }
export class SvrnNodeClient {
  constructor(baseUrl, token = null) { this.baseUrl = baseUrl.replace(/\/$/, ''); this.token = token }
  async request(path, options = {}) { const response = await fetch(this.baseUrl + path, { ...options, headers: { ...headersFor(this.token), ...(options.headers || {}) } }); return parse(response).then(result => result.json()) }
  async profile(username = '') { const suffix = username ? '/' + encodeURIComponent(username) : ''; return this.request('/api/profile' + suffix) }
  async discover() { return (await parse(await fetch(`${this.baseUrl}/.well-known/svrn-node.json`))).json() }
  async catalog() { return (await parse(await fetch(`${this.baseUrl}/svrn/v1/catalog`, { headers: headersFor(this.token) }))).json() }
  async search(query = '') { return (await parse(await fetch(`${this.baseUrl}/svrn/v1/search?q=${encodeURIComponent(query)}`, { headers: headersFor(this.token) }))).json() }
  async feed(cursor = '') { return (await parse(await fetch(`${this.baseUrl}/svrn/v1/feed?cursor=${encodeURIComponent(cursor)}`, { headers: headersFor(this.token) }))).json() }
  async package(issueId) { return (await parse(await fetch(`${this.baseUrl}/svrn/v1/issues/${encodeURIComponent(issueId)}/package`, { headers: headersFor(this.token) }))).blob() }
  async publish(archive) { return (await parse(await fetch(`${this.baseUrl}/svrn/v1/issues`, { method: 'POST', headers: { ...headersFor(this.token), 'Content-Type': 'application/vnd.svrn+zip' }, body: archive }))).json() }
}
