import { useEffect, useMemo, useRef, useState } from 'react';
import { motionSnapshot } from '../src/motion-inspector.js';
import { sessionMotionStore } from '../src/motion-decisions.js';

export default function useMotionInspector(session, sequenceIndex, revision) {
  const [result, setResult] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [desired, setDesired] = useState({}), [showDesired, setShowDesired] = useState(false), [active, setActive] = useState(null);
  const [focus, setFocus] = useState(null), [progress, setProgress] = useState(null);
  const worker = useRef(null), generation = useRef(0), current = useRef({});
  current.current = { session, sequenceIndex, revision };
  const cancel = () => { generation.current++; worker.current?.terminate(); worker.current = null; setBusy(false); };
  useEffect(() => { cancel(); setResult(null); setActive(null); setFocus(null); setDesired({}); setError(''); }, [session.id, sequenceIndex]);
  useEffect(() => { cancel(); }, [revision]);
  useEffect(() => () => worker.current?.terminate(), []);
  useEffect(() => {
    let active = true;
    sessionMotionStore(session).then(store => { if (active) setDesired(store.desired()); })
      .catch(cause => { if (active) setError(`Desired storage is unavailable: ${cause.message}`); });
    return () => { active = false; };
  }, [session.id]);
  const stale = result && (result.revision !== revision || result.sequenceIndex !== sequenceIndex || result.sessionId !== session.id);
  async function scan(nodeIds) {
    cancel(); const token = generation.current, started = { session, sequenceIndex, revision };
    setBusy(true); setError(''); setProgress(null);
    try {
      const store = await sessionMotionStore(session);
      if (token !== generation.current) return;
      setDesired(store.desired());
      const job = worker.current = new Worker(new URL('./motion-scan.worker.js', import.meta.url), { type: 'module' });
      const fail = message => { if (token !== generation.current) return; job.terminate(); worker.current = null; setBusy(false); setError(message); };
      job.onerror = event => fail(event.message || 'Motion scan failed.');
      job.onmessageerror = () => fail('Motion scan returned unreadable results.');
      job.onmessage = ({ data }) => {
        if (token !== generation.current || current.current.revision !== started.revision || current.current.session !== started.session || current.current.sequenceIndex !== started.sequenceIndex) return;
        if (data.progress) { setProgress(data.progress); return; }
        if (data.error) { fail(data.error); return; }
        job.terminate(); worker.current = null; setBusy(false); setResult({ ...data.result, revision, sequenceIndex, sessionId: session.id });
        setActive(null);
      };
      job.postMessage({ model: motionSnapshot(session.doc.model), options: { sequenceIndex, nodeIds } });
    } catch (cause) { if (token === generation.current) { cancel(); setError(cause.message); } }
  }
  async function mark(finding, value) {
    const started = current.current;
    try {
      const store = await sessionMotionStore(session);
      if (started.session !== current.current.session || started.revision !== current.current.revision || started.sequenceIndex !== current.current.sequenceIndex || stale) return;
      setDesired(store.mark(finding, value)); setError('');
    } catch (cause) { setError(`Desired decision was not saved: ${cause.message}`); }
  }
  const visible = useMemo(() => stale ? [] : (result?.findings || []).filter(f => showDesired || !desired[f.signature]), [result, stale, showDesired, desired]);
  const desiredCount = useMemo(() => (result?.findings || []).filter(f => desired[f.signature]).length, [result, desired]);
  return { result, busy, error, desired, desiredCount, showDesired, setShowDesired, active, setActive, focus, setFocus, progress, stale, visible, scan, cancel, mark };
}
