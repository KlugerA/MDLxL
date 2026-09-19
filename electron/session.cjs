const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

// A journal belongs to one process. Historical drafts and another running copy
// never count as a crash. Normal close removes only this process's journal.
class SessionJournal {
  constructor(root, { pid = process.pid, alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } } } = {}) {
    this.root = root; this.alive = alive;
    this.state = { id: crypto.randomBytes(12).toString('hex'), pid, dirty: false, startedAt: new Date().toISOString() };
    this.file = path.join(root, this.state.id + '.json');
    this.queue = Promise.resolve(); this.closed = false;
  }
  async begin() {
    await fs.mkdir(this.root, { recursive: true });
    let recoveryPrompt = false;
    for (const name of (await fs.readdir(this.root)).filter(name => /^[a-f0-9]{24}\.json$/.test(name))) {
      const file = path.join(this.root, name);
      try {
        const state = JSON.parse(await fs.readFile(file, 'utf8'));
        if (!Number.isSafeInteger(state.pid) || state.pid <= 0 || typeof state.dirty !== 'boolean') continue;
        if (this.alive(state.pid)) continue;
        recoveryPrompt ||= state.dirty;
        await fs.unlink(file).catch(() => {});
      } catch {}
    }
    await this.write();
    return recoveryPrompt;
  }
  write() {
    if (this.closed) return this.queue;
    const state = JSON.stringify(this.state);
    this.queue = this.queue.catch(() => {}).then(async () => {
      const temporary = this.file + '.tmp';
      await fs.writeFile(temporary, state);
      await fs.rename(temporary, this.file);
    });
    return this.queue;
  }
  setDirty(dirty) {
    if (this.state.dirty === !!dirty) return this.queue;
    this.state.dirty = !!dirty;
    return this.write();
  }
  async close() {
    this.closed = true;
    await this.queue.catch(() => {});
    await fs.unlink(this.file).catch(() => {});
  }
}

module.exports = { SessionJournal };
