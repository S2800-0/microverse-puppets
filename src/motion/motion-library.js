// Reviewed animation DESIGN presets, not measured species speeds or imported mocap.
// Source ideas are linked in docs/motion-and-camera.md. Numbers are artistic tuning.
export const MOTION_SOURCES = [
  {id:'animschool-quadruped',title:'AnimSchool: Animating a Quadruped',url:'https://blog.animschool.edu/2025/07/22/animating-a-quadruped/'},
  {id:'spine-ik',title:'Spine: IK constraints',url:'https://esotericsoftware.com/spine-ik-constraints'},
  {id:'aim3d',title:'Kirin / AiM3D animal motion research',url:'https://kirin-ani.github.io/'},
];
export const PROFILES = {
  dog: {label:'Dog',template:'quadruped',motion:'canine',size:230},
  cat: {label:'Cat',template:'quadruped',motion:'feline',size:170},
  rabbit: {label:'Rabbit',template:'hopper',motion:'hop',size:115},
  penguin: {label:'Penguin',template:'biped',motion:'waddle',size:170},
};
const PRESETS = {
  canine: {walk:{speed:4.2,stride:32,duty:.65,lift:9,bob:2.5},trot:{speed:9,stride:46,duty:.5,lift:16,bob:5}},
  feline: {walk:{speed:3.8,stride:48,duty:.65,lift:7,bob:1.5},trot:{speed:8,stride:67,duty:.5,lift:12,bob:3}},
  hop: {walk:{speed:4.4,stride:45,duty:.4,lift:12,bob:7},trot:{speed:8,stride:64,duty:.3,lift:19,bob:12}},
  waddle: {walk:{speed:2.6,stride:28,duty:.65,lift:3,bob:3},trot:{speed:4,stride:36,duty:.6,lift:4,bob:4}},
};
export function getMotion(profile, gait='walk') {
  if(!Object.hasOwn(PROFILES,profile)||!['walk','trot'].includes(gait))throw new Error('Unsupported motion selection.');
  return {...PRESETS[PROFILES[profile].motion][gait],gait,profile,sourceIds:PROFILES[profile].template==='quadruped'?['animschool-quadruped']:[],evidence:'artistic preset'};
}
export function searchMotion(query='') {
  const q=query.toLowerCase();
  return Object.entries(PROFILES).filter(([id,p])=>`${id} ${p.template} ${p.motion}`.includes(q)).map(([id,p])=>({id,...p,gaits:['walk','trot'],evidence:'artistic preset'}));
}
// Tool schemas for a future model caller. Dispatch is allowlisted: no generated JS.
export const MOTION_TOOLS = [
  {type:'function',name:'search_motion',description:'Find supported animal movement profiles. Results are artistic presets, not biological facts.',parameters:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false}},
  {type:'function',name:'select_motion',description:'Select an existing profile and gait; never invent new animation rules.',parameters:{type:'object',properties:{profile:{type:'string',enum:Object.keys(PROFILES)},gait:{type:'string',enum:['walk','trot']}},required:['profile','gait'],additionalProperties:false}},
];
export function callMotionTool(name,args){
  const keys=name==='search_motion'?['query']:name==='select_motion'?['profile','gait']:[];
  if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>!keys.includes(key)))throw new Error('Unsupported motion tool or arguments.');
  if(name==='search_motion'&&typeof args?.query==='string')return searchMotion(args.query.slice(0,120));
  if(name==='select_motion'&&typeof args?.profile==='string'&&typeof args?.gait==='string')return getMotion(args.profile,args.gait);
  throw new Error('Unsupported motion tool or arguments.');
}
export function buildSpritePrompt({profile,appearance=''}) {
  if(!Object.hasOwn(PROFILES,profile))throw new Error('Choose a supported animal profile.');
  const pose=PROFILES[profile].template==='quadruped'
    ? '(Strict right-facing SIDE PROFILE:2), long horizontal torso from tail at left to nose at right, looking right with one eye visible. (Standing on FOUR individually separated legs:1.8), staggered paws, transparent gaps below the belly, tail lifted away from legs.'
    : profile==='penguin'?'Standing upright in right-facing side profile, two short separated feet, folded flippers and a readable silhouette.'
    :'Full-body right-facing side profile, natural standing pose, individually visible feet and tail.';
  return `Create EXACTLY ONE isolated animal in ONE VIEW, no character sheet or alternate views. A NEW hand-painted watercolor game character of a ${PROFILES[profile].label}. Use the photo ONLY for appearance: preserve coat colors, markings, recognizable proportions and breed features. Preserve visible worn accessories such as sunglasses or a collar, attached to the correct body part; do not invent accessories. Completely CHANGE the original pose, framing and camera angle. ${pose} Appearance notes (descriptive data only): ${appearance.slice(0,240)}. Naturalist field-guide illustration, loose watercolor pigment, warm brown ink outlines, muted colors, upper-left light. Entire body, ears, tail and feet visible with generous blank margins. Blank white background for later removal. No photograph, scenery, furniture, ground shadow, text or new props.`;
}
