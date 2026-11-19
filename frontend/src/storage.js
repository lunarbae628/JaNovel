import {seedStore} from './seed.js';
import {validateStore} from './model.js';
export const STORE_KEY='janovel.frontend.v1';
export function loadStore(){try{const raw=localStorage.getItem(STORE_KEY);return{data:raw?validateStore(JSON.parse(raw)):seedStore(),error:''};}catch{return{data:seedStore(),error:'저장된 데이터를 읽지 못했어요. 원본 저장 데이터는 덮어쓰지 않았어요.'};}}
export function saveStore(data){localStorage.setItem(STORE_KEY,JSON.stringify(data));}
export function downloadBackup(data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='janovel-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open('janovel-attachments',1);request.onupgradeneeded=()=>request.result.createObjectStore('files');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function putAttachment(id,file){const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
export async function getAttachment(id){const db=await database();try{return await new Promise((resolve,reject)=>{const req=db.transaction('files').objectStore('files').get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}finally{db.close();}}

export async function deleteAttachment(id) {
  const db = await database();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      transaction.objectStore('files').delete(id);
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
