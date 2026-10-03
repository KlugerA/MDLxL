export const HIVE_DURATION_ERROR='Hive does not support GIF previews longer than 5 seconds.';
export function validateShowcaseExport(target,length,playlist=[]){
  if((target==='hive'||target==='hive-main')&&(Number(length)>5||playlist.some(row=>Number(row.seconds)>5)||playlist.reduce((sum,row)=>sum+(Number(row.seconds)||0),0)>5))throw Error(HIVE_DURATION_ERROR);
}
export function showcaseExportPreferences(preferences,target){
  return {...preferences,capture:{...preferences?.capture,fps:target?30:preferences?.capture?.fps||30,recordingQuality:preferences?.capture?.recordingQuality||'high'}};
}
