import fs from 'node:fs/promises';import path from 'node:path';
export interface PrivateFileStore {put(key:string,data:Uint8Array):Promise<void>;get(key:string):Promise<Uint8Array>}
// Development adapter only. Production must supply private object storage, encryption and IAM.
export class LocalPrivateFileStore implements PrivateFileStore {
 private root:string;
 constructor(root:string){this.root=path.resolve(root);}
 private file(key:string){if(!/^[0-9a-f-]{36}$/.test(key))throw new Error('INVALID_OBJECT_KEY');return path.join(this.root,key);}
 private async verifiedRoot(){await fs.mkdir(this.root,{recursive:true,mode:0o700});const stat=await fs.lstat(this.root);if(stat.isSymbolicLink()||!stat.isDirectory())throw new Error('UNSAFE_OBJECT_DIRECTORY');return fs.realpath(this.root);}
 async put(key:string,data:Uint8Array){const real=await this.verifiedRoot();const file=path.join(real,path.basename(this.file(key)));const handle=await fs.open(file,'wx',0o600);try{await handle.writeFile(data);await handle.sync();}finally{await handle.close();}}
 async get(key:string){const real=await this.verifiedRoot();const file=path.join(real,path.basename(this.file(key)));const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>10485760)throw new Error('UNSAFE_OBJECT');return fs.readFile(file);}
}
