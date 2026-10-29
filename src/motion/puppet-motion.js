// Continuous cutout deformation. The limb remains one textured surface rather than
// two rigid pictures that expose a hard cut at the joint. Not anatomical reconstruction.
export function footTarget(phase, {duty,stride,lift}) {
  if (![phase, duty, stride, lift].every(Number.isFinite) || duty <= 0 || duty >= 1 || stride < 0 || lift < 0) throw new Error('Invalid gait geometry.');
  const p=((phase%1)+1)%1;
  if(p<duty)return {x:stride*(.5-p/duty),y:0,contact:true};
  const u=(p-duty)/(1-duty),e=u*u*(3-2*u);
  return {x:stride*(-.5+e),y:-Math.sin(Math.PI*u)*lift,contact:false};
}
export function solveLimb(root, foot, upper, lower, bend=1) {
  if (![root.x, root.y, foot.x, foot.y, upper, lower, bend].every(Number.isFinite) || upper <= 0 || lower <= 0 || ![1,-1].includes(bend)) throw new Error('Invalid limb geometry.');
  const dx=foot.x-root.x,dy=foot.y-root.y,raw=Math.hypot(dx,dy);
  const epsilon=Math.min(upper,lower)*1e-6;
  const d=Math.max(Math.abs(upper-lower)+epsilon,Math.min(upper+lower-epsilon,raw));
  const angle=Math.atan2(dy,dx),cos=Math.max(-1,Math.min(1,(upper*upper+d*d-lower*lower)/(2*upper*d)));
  const a=angle+bend*Math.acos(cos);
  return {joint:{x:root.x+Math.cos(a)*upper,y:root.y+Math.sin(a)*upper},foot:{x:root.x+Math.cos(angle)*d,y:root.y+Math.sin(angle)*d}};
}
// Centerline displacement is continuous on both sides of the inferred bend.
// The overlap above the root follows the torso, keeping the attachment covered.
export function deformLimbPoint(point,source,target){
  let a,b,ta,tb;
  if(point.y<=source.root.y)return {x:point.x+target.root.x-source.root.x,y:point.y+target.root.y-source.root.y};
  if(point.y<source.joint.y){a=source.root;b=source.joint;ta=target.root;tb=target.joint;}
  else {a=source.joint;b=source.foot;ta=target.joint;tb=target.foot;}
  const t=Math.max(0,Math.min(1,(point.y-a.y)/(b.y-a.y||1)));
  const dx=(ta.x-a.x)*(1-t)+(tb.x-b.x)*t,dy=(ta.y-a.y)*(1-t)+(tb.y-b.y)*t;
  return {x:point.x+dx,y:point.y+dy};
}
function triangle(ctx,image,s,t){
  const [a,b,c]=s,[p,q,r]=t;
  const den=a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y);
  if(Math.abs(den)<1e-8)return;
  const A=(p.x*(b.y-c.y)+q.x*(c.y-a.y)+r.x*(a.y-b.y))/den;
  const B=(p.y*(b.y-c.y)+q.y*(c.y-a.y)+r.y*(a.y-b.y))/den;
  const C=(p.x*(c.x-b.x)+q.x*(a.x-c.x)+r.x*(b.x-a.x))/den;
  const D=(p.y*(c.x-b.x)+q.y*(a.x-c.x)+r.y*(b.x-a.x))/den;
  const E=p.x-A*a.x-C*a.y,F=p.y-B*a.x-D*a.y;
  ctx.save();ctx.beginPath();
  // Tiny subpixel overlap prevents antialiasing hairlines at shared triangle edges.
  const center={x:(p.x+q.x+r.x)/3,y:(p.y+q.y+r.y)/3};
  const expanded=t.map(v=>{const dx=v.x-center.x,dy=v.y-center.y,d=Math.hypot(dx,dy)||1;return {x:v.x+dx/d*.5,y:v.y+dy/d*.5};});
  ctx.moveTo(expanded[0].x,expanded[0].y);ctx.lineTo(expanded[1].x,expanded[1].y);ctx.lineTo(expanded[2].x,expanded[2].y);ctx.closePath();ctx.clip();ctx.transform(A,B,C,D,E,F);ctx.drawImage(image,0,0);ctx.restore();
}
export function prepareJointPieces(rig){
  for(const leg of rig.legs){
    const pixels=leg.canvas.getContext('2d').getImageData(0,0,rig.W,rig.H).data;
    let bottom=0,top=rig.H,left=rig.W,right=0;
    for(let y=0;y<rig.H;y++)for(let x=0;x<rig.W;x++)if(pixels[(y*rig.W+x)*4+3]>40){bottom=Math.max(bottom,y);top=Math.min(top,y);left=Math.min(left,x);right=Math.max(right,x);}
    const root={x:leg.pivot[0]*rig.W,y:leg.pivot[1]*rig.H},jointY=root.y+(bottom-root.y)*.53;
    let sx=0,n=0;for(let y=Math.max(0,bottom-5);y<=bottom;y++)for(let x=left;x<=right;x++)if(pixels[(y*rig.W+x)*4+3]>40){sx+=x;n++;}
    const foot={x:n?sx/n:root.x,y:bottom},joint={x:root.x+(foot.x-root.x)*.53,y:jointY};
    const ys=[Math.max(0,top-2),root.y];for(let j=1;j<=5;j++)ys.push(root.y+(jointY-root.y)*j/5);for(let j=1;j<=6;j++)ys.push(jointY+(bottom+2-jointY)*j/6);
    leg.articulation={root,joint,foot,left:Math.max(0,left-2),right:Math.min(rig.W,right+3),ys:[...new Set(ys)].sort((a,b)=>a-b)};
  }
  return rig;
}
function drawLimbMesh(ctx,leg,target){
  const a=leg.articulation;
  for(let i=0;i<a.ys.length-1;i++){
    const y=a.ys[i],yn=a.ys[i+1],s=[{x:a.left,y},{x:a.right,y},{x:a.right,y:yn},{x:a.left,y:yn}];
    const t=s.map(p=>deformLimbPoint(p,a,target));
    triangle(ctx,leg.canvas,[s[0],s[1],s[2]],[t[0],t[1],t[2]]);
    triangle(ctx,leg.canvas,[s[0],s[2],s[3]],[t[0],t[2],t[3]]);
  }
}
export function drawPuppet(ctx,rig,{size,phase,moving,preset,phases,clock=0}){
  const scale=size/rig.W,bob=moving?Math.sin(phase*Math.PI*4)*preset.bob/scale:Math.sin(clock*2)*.5/scale;
  ctx.save();ctx.translate(-size*.5,-size*.85);ctx.scale(scale,scale);
  const drawLeg=l=>{const a=l.articulation;if(!moving){ctx.drawImage(l.canvas,0,bob);return;}
    const key=(l.hind?'hind':'fore')+(l.side==='near'?'Near':'Far');
    const p=footTarget(phase+phases[key],preset),root={x:a.root.x,y:a.root.y+bob};
    const target={x:a.foot.x+p.x/scale,y:a.foot.y+p.y/scale};
    const u=Math.hypot(a.joint.x-a.root.x,a.joint.y-a.root.y),lo=Math.hypot(a.foot.x-a.joint.x,a.foot.y-a.joint.y);
    const solved=solveLimb(root,target,u*1.03,lo*1.03,l.hind?1:-1);
    drawLimbMesh(ctx,l,{root,joint:solved.joint,foot:solved.foot});
  };
  rig.legs.filter(l=>l.side==='far').forEach(drawLeg);
  // One continuous torso image: no independent column edges or fur striping.
  ctx.drawImage(rig.body,0,bob);
  rig.legs.filter(l=>l.side==='near').forEach(drawLeg);ctx.restore();
}
