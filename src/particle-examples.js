import {createStarterRecipe} from './particle-starters.js';
import {particleBurstTrack} from './particle-sweep.js';
export const particleExampleNames=[['smoke','Smoke'],['sparks','Sparks'],['glow','Magic glow'],['impact','Impact burst'],['sweep','Weapon sweep']];
/** Original teaching variants. The demonstration path is attached only to render clones. */
export function particleExamplePair(kind){
 const base=createStarterRecipe(kind==='sweep'?'streak':kind==='sparks'?'streak':kind),other=structuredClone(base),p=other.native.ParticleEmitters2[0];
 if(kind==='smoke'){p.ParticleScaling.fill(18);p.Alpha.fill(100);return {pairs:[{label:'Constant size · hard cut',recipe:other},{label:'Expands · fades away',recipe:base}],times:[500,2000,4000]};}
 if(kind==='sparks'){p.EmissionRate=180;p.LifeSpan=2;p.ParticleScaling.fill(5);return {pairs:[{label:'Dense · long lasting',recipe:other},{label:'Short · separate streaks',recipe:base}],times:[200,800,1800]};}
 if(kind==='glow'){for(const n of other.native.ParticleEmitters2){n.ParticleScaling=n.ParticleScaling.map(v=>v*3);n.EmissionRate*=5;n.Alpha.fill(255);}return {pairs:[{label:'Wide · bright layers',recipe:other},{label:'Small core · soft accent',recipe:base}],times:[200,800,1800]};}
 if(kind==='impact'){p.EmissionRate=particleBurstTrack(p,[0,5000],1800,30);return {pairs:[{label:'Impact at 0.6 seconds',recipe:base},{label:'Impact at 1.8 seconds',recipe:other}],times:[400,800,2000]};}
 const ribbon=createStarterRecipe('ribbon');return {pairs:[{label:'Separate PE2 streaks',recipe:base,motion:true},{label:'Connected ribbon',recipe:ribbon,motion:true}],times:[500,1800,3300]};
}
