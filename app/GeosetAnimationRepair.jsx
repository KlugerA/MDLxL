import React, { useState } from 'react';
import { classifyVisibilityGeoset, describeGeosetTint } from '../src/geoset-animation-repair.js';
import './geoset-repair.css';

export default function GeosetAnimationRepair({ model, name, groups, receipt, busy, unavailable, status, onRepair, onUndo, onAccept, onOpen, onSave }) {
  const [tint, setTint] = useState('preserve'), [owners, setOwners] = useState({}), [colors, setColors] = useState({});
  const [rebuildVisibility, setRebuild] = useState(false), [deferred, setDeferred] = useState(false), [error, setError] = useState('');
  const run = async action => { setError(''); try { await action(); } catch (failure) { setError(failure.message || String(failure)); } };
  const conflicts = tint === 'preserve' && groups.some(group => group.colorConflict && colors[group.geosetId] == null);
  let classifications = [], classificationError = '';
  if (rebuildVisibility) try { classifications = model.Geosets.map((_, id) => ({ id, ...classifyVisibilityGeoset(model, id) })); } catch (failure) { classificationError = failure.message; }
  const roleNames = { body: 'Body', guts: 'Guts', 'body-glow': 'Body visibility (glow bone)', 'portrait-background': 'Portrait only', 'unchanged-additive': 'Additive glow — unchanged' };
  return <main className="geoset-repair-screen"><section className="geoset-repair-window" role="dialog" aria-modal="true" aria-label="Geoset animation repair">
    <header>{receipt ? 'Geoset animation repair complete' : 'Duplicate geoset animations detected'}</header>
    <div className="geoset-repair-body">
      <p className="geoset-repair-name">{name}</p>
      {receipt ? <>
        <p>{`Removed ${receipt.report.removedCount} suspected duplicate records. The repaired model was saved and reloaded.`}</p>
        <ul>{receipt.report.groups.map(group => <li key={group.geosetId}>Geoset {group.geosetId + 1}: kept animation #{group.kept + 1}; removed {group.removed.map(id => `#${id + 1}`).join(', ')}{group.colorSource != null ? `; tint from #${group.colorSource + 1}` : ''}.</li>)}</ul>
        <p>{receipt.report.tint === 'fresh' ? `Removed geoset tinting from ${receipt.report.clearedTints} surviving records.` : 'Selected tint channels retained, including their interpolation and global-sequence references.'}</p>
        <p>{receipt.report.rebuildVisibility ? 'Visibility rebuilt using the reviewed material and glow-bone rules.' : 'Selected visibility tracks were kept intact; no Decay/Portrait rebuild was applied.'} Bind-pose extents recalculated; existing animated bounds retained.</p>
        <p>Pre-repair backup:<br/><span className="geoset-repair-path">{receipt.backupPath}</span></p>
        {receipt.diskBackupPath && <p>Original disk version also retained:<br/><span className="geoset-repair-path">{receipt.diskBackupPath}</span></p>}
        <p>Undo restores the pre-repair backup to the model file. It will refuse to overwrite a file changed since the repair. Backups remain available after closing this window.</p>
      </> : deferred ? <>
        <p>The model is unchanged. Animation editing is paused because more than one animation owns the same geoset.</p>
        <p>You can return to the repair options, save a copy, or open another model.</p>
      </> : <>
        <p>{`${groups.length} geoset${groups.length === 1 ? ' has' : 's have'} multiple animation owners. Nothing has been changed. Review the proposed visibility owner below.`}</p>
        <p>The most Alpha keys is a suggestion, not proof of the correct track. Constant Alpha 1 records are removed only when another owner is retained.</p>
        <fieldset disabled={busy}><legend>Tint handling</legend>
          <label><input type="radio" name="repair-tint" checked={tint === 'preserve'} onChange={() => setTint('preserve')}/> Keep color tinting</label>
          <label><input type="radio" name="repair-tint" checked={tint === 'fresh'} onChange={() => setTint('fresh')}/> Start fresh — remove all geoset tinting</label>
          <small>Material colors, textures and team color are not removed.</small>
        </fieldset>
        {conflicts && <p role="alert">Conflicting tint tracks need your choice before repair. <button disabled={busy} onClick={() => {
          const group = groups.find(item => item.colorConflict && colors[item.geosetId] == null);
          const select = document.querySelector(`select[data-geoset-tint="${group.geosetId}"]`);
          select?.scrollIntoView({ block: 'nearest' }); select?.focus({ preventScroll: true });
        }}>Review tint conflict</button></p>}
        <div className="geoset-repair-list">{groups.map(group => <fieldset key={group.geosetId} disabled={busy}><legend>Geoset {group.geosetId + 1}</legend>
          <label>Visibility owner <select aria-label={`Visibility owner for geoset ${group.geosetId + 1}`} value={owners[group.geosetId] ?? group.suggestedOwner} onChange={event => setOwners({ ...owners, [group.geosetId]: Number(event.target.value) })}>
            {group.records.map(record => <option key={record.index} value={record.index}>#{record.index + 1} — {record.animatedAlpha ? `${record.alphaKeys} Alpha keys` : `static Alpha ${record.staticAlpha}`} {record.hasTint ? `· ${record.colorKeys || 'static'} tint` : ''}</option>)}
          </select></label>
          {tint === 'preserve' && group.colorConflict ? <label>Conflicting tints — choose one <select data-geoset-tint={group.geosetId} aria-label={`Tint source for geoset ${group.geosetId + 1}`} value={colors[group.geosetId] ?? ''} onChange={event => setColors({ ...colors, [group.geosetId]: event.target.value === '' ? null : Number(event.target.value) })}>
            <option value="">Choose the tint to keep…</option>{group.colorSources.map(index => <option key={index} value={index}>#{index + 1} — {describeGeosetTint(model.GeosetAnims[index].Color)}</option>)}
          </select></label> : tint === 'preserve' && group.suggestedColor != null ? <small>Tint retained from animation #{group.suggestedColor + 1}.</small> : null}
          {tint === 'preserve' && group.colorConflict && <details><summary>Inspect conflicting tint values</summary>{group.colorSources.map(index => <div key={index}><strong>Animation #{index + 1}</strong><pre>{JSON.stringify(model.GeosetAnims[index].Color, (_, value) => ArrayBuffer.isView(value) ? Array.from(value) : value, 2)}</pre></div>)}</details>}
        </fieldset>)}</div>
        <label><input type="checkbox" checked={rebuildVisibility} disabled={busy} onChange={event => setRebuild(event.target.checked)}/> Also rebuild visibility using Decay / Portrait rules</label>
        {rebuildVisibility && <>
          <p>This replaces visibility tracks across the model. Body and glow-bound geosets: visible normally, Decay Flesh 1→0, Decay Bone(s) 0→0. Guts: Decay Flesh 1→1, Decay Bone(s) 1→0, otherwise hidden.</p>
          <p>Replaceable ID 2 with a directly attached bone containing “glow” (any case) follows body visibility. Other non-additive ID 2 geosets become Portrait-only; other additive ID 2 geosets stay unchanged. Bone names are a heuristic: review these assignments.</p>
          {classificationError ? <p role="alert">{classificationError}</p> : <ul className="geoset-repair-classifications">{classifications.map(row => <li key={row.id}>Geoset {row.id + 1}: {roleNames[row.role]}{row.boneNames.length ? ` — ${row.boneNames.join(', ')}` : ' — no direct bone binding'}</li>)}</ul>}
        </>}
        <p>A verified backup is created before the file is replaced. The result window offers OK and Undo.</p>
      </>}
      {unavailable && !receipt && <p role="alert">{unavailable}</p>}
      {error && <p role="alert">{error}</p>}
      {status?.startsWith('Error:') && <p role="alert">{status}</p>}
    </div>
    <footer>{receipt ? <><button disabled={busy} onClick={() => run(onUndo)}>Undo repair</button><button disabled={busy} onClick={onAccept}>OK</button></> : <>
      <button disabled={busy} onClick={onOpen}>Open another model</button>
      <button disabled={busy} onClick={onSave}>Save a copy…</button>
      <button disabled={busy} onClick={() => setDeferred(!deferred)}>{deferred ? 'Review repair…' : 'Leave unchanged'}</button>
      {!deferred && <button disabled={busy || !!unavailable || conflicts || !!classificationError} onClick={() => run(() => onRepair({ tint, owners, colors, rebuildVisibility }))}>{busy ? 'Repairing…' : 'Back up & repair'}</button>}
    </>}</footer>
  </section></main>;
}
