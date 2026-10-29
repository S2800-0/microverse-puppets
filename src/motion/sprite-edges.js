// Clean matte colors at translucent edges; preserve alpha except invisible noise.
// Saturated red/yellow spill is corrected only beside transparency and only when
// a nearby non-spill interior pigment is available. Opaque interior markings stay.
export function cleanEdgePixels(data,width,height,radius=6){
 const source=new Uint8ClampedArray(data);
 const spill=i=>(source[i]>180&&source[i+1]<source[i]*.55&&source[i+2]<source[i]*.45)||(source[i]>220&&source[i+1]>180&&source[i+2]<source[i+1]*.4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,a=source[i+3];if(!a)continue;
  if(a<=8){data[i]=data[i+1]=data[i+2]=data[i+3]=0;continue;}
  let boundary=false;
  if(a>=245){if(!spill(i))continue;for(let dy=-2;dy<=2&&!boundary;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<width&&yy<height&&source[(yy*width+xx)*4+3]<40){boundary=true;break;}}if(!boundary)continue;}
  let best=Infinity,at=-1;
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   const xx=x+dx,yy=y+dy,d=dx*dx+dy*dy;if(xx<0||yy<0||xx>=width||yy>=height||d>=best)continue;
   const k=(yy*width+xx)*4;if(source[k+3]>=245&&!spill(k)){best=d;at=k;}
  }
  if(at>=0)for(let c=0;c<3;c++)data[i+c]=source[at+c];
 }
 return data;
}
export function cleanCanvasEdges(canvas){const ctx=canvas.getContext('2d',{willReadFrequently:true}),im=ctx.getImageData(0,0,canvas.width,canvas.height);cleanEdgePixels(im.data,canvas.width,canvas.height);ctx.putImageData(im,0,0);return canvas;}
