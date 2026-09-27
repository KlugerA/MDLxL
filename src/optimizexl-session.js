/** Review history is private to OptimizeXL. The source document is never edited. */
export class OptimizeXLSession {
  constructor(bytes, name = 'model.mdx') {
    this.name = name;
    this.before = new Uint8Array(bytes);
    this.accepted = new Uint8Array(bytes);
    this.steps = [];
    this.revision = 0;
    this.candidate = null;
  }
  propose(result, revision) {
    if (revision !== this.revision) return false;
    this.candidate = result;
    return true;
  }
  approve(stage, settings) {
    if (!this.candidate) throw Error('Wait for the preview before approving.');
    this.steps.push({ stage, settings: structuredClone(settings), before: this.accepted, skipped: false });
    this.accepted = new Uint8Array(this.candidate.bytes);
    this.candidate = null;
    this.revision++;
  }
  skip(stage) {
    this.steps.push({ stage, before: this.accepted, skipped: true });
    this.candidate = null;
    this.revision++;
  }
  back() {
    const step = this.steps.pop();
    if (!step) return null;
    this.accepted = step.before;
    this.candidate = null;
    this.revision++;
    return step;
  }
  savePayload() {
    return { name: this.name, before: new Uint8Array(this.before), after: new Uint8Array(this.accepted), nuclear: this.steps.some(s => s.stage === 'nuclear' && !s.skipped) };
  }
}
