export interface SavedResume { name: string; type: string; size: number; savedAt: string; blob: Blob; }
export interface ResumeAttachment { name: string; type: string; size: number; base64: string; }
const database = 'applymate.files';
async function open(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(database,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('files');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('Could not open local resume storage.'));
  });
}
async function transaction<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T> {
  const db=await open();
  try {return await new Promise<T>((resolve,reject)=>{
    const tx=db.transaction('files',mode);const request=operation(tx.objectStore('files'));
    tx.oncomplete=()=>resolve(request.result);
    tx.onerror=()=>reject(new Error('Could not save or read the resume. Check available device storage.'));
    tx.onabort=()=>reject(new Error('Resume storage was interrupted.'));
  });} finally {db.close();}
}
export async function validateResumeFile(file:File):Promise<string> {
  if(!file.size)throw new Error('Choose a nonempty resume file.');
  if(file.size>10*1024*1024)throw new Error('Choose a resume smaller than 10 MB.');
  const header=new Uint8Array(await file.slice(0,5).arrayBuffer());
  if(/\.pdf$/i.test(file.name)&&String.fromCharCode(...header)==='%PDF-')return 'application/pdf';
  if(/\.docx$/i.test(file.name)&&header[0]===0x50&&header[1]===0x4b&&header[2]===3&&header[3]===4)return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  throw new Error('Choose a valid PDF or DOCX resume.');
}
export const resumeStore={
  async get():Promise<SavedResume|null>{return (await transaction<SavedResume|undefined>('readonly',s=>s.get('resume')))||null;},
  async set(file:File):Promise<SavedResume>{const type=await validateResumeFile(file);const resume={name:file.name,type,size:file.size,savedAt:new Date().toISOString(),blob:new Blob([await file.arrayBuffer()],{type})};await transaction('readwrite',s=>s.put(resume,'resume'));return resume;},
  async clear(){await transaction('readwrite',s=>s.delete('resume'));},
};
export function isResumeField(label:string):boolean {
  const text=label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ');
  return /\b(resume|cv|curriculum vitae)\b/i.test(text)&&!/cover.?letter|transcript|certificate|supporting|additional|portfolio/i.test(text);
}
export function acceptsResume(accept:string|undefined,resume:Pick<SavedResume,'name'|'type'>):boolean {
  if(!accept?.trim())return true;
  const extension='.'+resume.name.split('.').pop()!.toLowerCase();
  return accept.split(',').some(part=>{const type=part.trim().toLowerCase();return type===extension||type===resume.type||type==='*/*'||(type.endsWith('/*')&&resume.type.startsWith(type.slice(0,-1)));});
}
export async function attachmentFor(resume:SavedResume):Promise<ResumeAttachment> {
  const bytes=new Uint8Array(await resume.blob.arrayBuffer());let binary='';
  for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return {name:resume.name,type:resume.type,size:resume.size,base64:btoa(binary)};
}
