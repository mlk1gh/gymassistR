import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ReplitConnectors } = require('@replit/connectors-sdk');

const OWNER = 'mlk1gh';
const REPO = 'gymassistR';
const BRANCH = 'main';

const connectors = new ReplitConnectors();

async function ghApi(method, path, body) {
  const opts = { method };
  if (body) opts.body = body;
  const res = await connectors.proxy('github', `/repos/${OWNER}/${REPO}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(`GitHub API ${method} ${path} (${res.status}): ${JSON.stringify(data).slice(0,200)}`);
  return data;
}

function git(cmd) { return execSync(`git ${cmd}`, { encoding: 'utf8' }).trim(); }
function gitBuffer(cmd) { return execSync(`git ${cmd}`, { encoding: 'buffer' }); }

function parseCommit(sha) {
  const raw = git(`cat-file commit ${sha}`);
  const lines = raw.split('\n');
  const c = { sha, parents: [], message: '' };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l === '') { c.message = lines.slice(i + 1).join('\n'); break; }
    if (l.startsWith('tree ')) c.tree = l.slice(5);
    else if (l.startsWith('parent ')) c.parents.push(l.slice(7));
    else if (l.startsWith('author ')) c.author = l.slice(7);
    else if (l.startsWith('committer ')) c.committer = l.slice(10);
  }
  return c;
}

function parseSig(sig) {
  const m = sig.match(/^(.*?)\s+<(.+?)>\s+(\d+)\s+([+-]\d{4})$/);
  const [, name, email, ts, tz] = m;
  const d = new Date(parseInt(ts) * 1000).toISOString().replace('Z', '');
  return { name, email, date: `${d}${tz.slice(0,3)}:${tz.slice(3)}` };
}

async function uploadBlob(sha) {
  const res = await connectors.proxy('github', `/repos/${OWNER}/${REPO}/git/blobs/${sha}`, { method: 'GET' });
  if (res.ok) return sha;
  const b64 = gitBuffer(`cat-file blob ${sha}`).toString('base64');
  const r = await ghApi('POST', '/git/blobs', { content: b64, encoding: 'base64' });
  return r.sha;
}

async function createTree(commitSha, parentSha, baseTreeSha) {
  const diff = git(`diff-tree --no-commit-id -r --name-status ${parentSha} ${commitSha}`);
  if (!diff) return baseTreeSha;
  const changed = diff.split('\n').map(l => { const [s, ...p] = l.split('\t'); return { status: s[0], path: p[p.length-1] }; });
  const items = [];
  for (const { status, path } of changed) {
    if (status === 'D') { items.push({ path, mode: '100644', type: 'blob', sha: null }); continue; }
    const info = git(`ls-tree ${commitSha} -- "${path}"`);
    if (!info) continue;
    const parts = info.split(/\s+/);
    items.push({ path, mode: parts[0], type: 'blob', sha: await uploadBlob(parts[2]) });
  }
  if (!items.length) return baseTreeSha;
  const r = await ghApi('POST', '/git/trees', { base_tree: baseTreeSha, tree: items });
  return r.sha;
}

async function main() {
  const remoteRef = await ghApi('GET', `/git/refs/heads/${BRANCH}`);
  const remoteHead = remoteRef.object.sha;
  const localHead = git('rev-parse HEAD');

  const toCheck = git(`rev-list ${localHead} --max-count=20`).split('\n').filter(Boolean);
  let baseLocalSha = null;
  let baseRemoteSha = remoteHead;

  for (const sha of toCheck) {
    const res = await connectors.proxy('github', `/repos/${OWNER}/${REPO}/git/commits/${sha}`, { method: 'GET' });
    if (res.ok) { baseLocalSha = sha; break; }
  }

  const commits = git(`rev-list ${localHead} ${baseLocalSha ? `^${baseLocalSha}` : ''} --reverse`).split('\n').filter(Boolean);
  if (!commits.length) { console.log('Already up to date.'); return; }
  console.log(`Pushing ${commits.length} commit(s)...`);

  const baseCommit = await ghApi('GET', `/git/commits/${baseRemoteSha}`);
  let prevLocal = baseLocalSha ?? commits[0];
  let prevRemoteTree = baseCommit.tree.sha;
  let lastRemote = baseRemoteSha;

  for (const sha of commits) {
    const c = parseCommit(sha);
    console.log(`  ${sha.slice(0,7)}: ${c.message.split('\n')[0]}`);
    const tree = await createTree(sha, prevLocal === sha ? (c.parents[0] ?? sha) : prevLocal, prevRemoteTree);
    const r = await ghApi('POST', '/git/commits', {
      message: c.message, tree, parents: [lastRemote],
      author: parseSig(c.author), committer: parseSig(c.committer),
    });
    prevLocal = sha; prevRemoteTree = tree; lastRemote = r.sha;
  }

  await ghApi('PATCH', `/git/refs/heads/${BRANCH}`, { sha: lastRemote, force: true });
  console.log(`Done → https://github.com/${OWNER}/${REPO}`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
