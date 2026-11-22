// Re-encoding removes image metadata; only the resulting preview is uploaded.
export async function compressLabelPhoto(file) {
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP image.');
 if(file.size>20*1024*1024)throw Error('Choose a photo smaller than 20 MB.');
 const url=URL.createObjectURL(file),img=new Image();
 try {
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Photo could not be read.'));img.src=url;});
  if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>60000000)throw Error('Photo dimensions are too large. Crop the label first.');
  const canvas=document.createElement('canvas');
  for(const max of [2200,1800,1400,1000]){
   const scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
   canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
   const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
   for(const quality of [.9,.8,.65]){
    const data=canvas.toDataURL('image/jpeg',quality);
    if(data.startsWith('data:image/jpeg;base64,')&&data.length<=460000)return data;
   }
  }
  throw Error('Photo is too detailed to upload clearly. Crop closer to the nutrition label.');
 } finally {URL.revokeObjectURL(url);}
}
