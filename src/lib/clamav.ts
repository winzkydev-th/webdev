import net from 'node:net';
export interface FileScanner {scan(data:Uint8Array,signal:AbortSignal):Promise<'clean'|'infected'>}
// ClamAV INSTREAM protocol. A missing/unreachable scanner never means a clean file.
export class ClamAvScanner implements FileScanner {
 private host:string;private port:number;
 constructor(host='127.0.0.1',port=3310){this.host=host;this.port=port;}
 async scan(data:Uint8Array,signal:AbortSignal):Promise<'clean'|'infected'>{
 if(signal.aborted)throw new Error('SCAN_ABORTED');
 return new Promise((resolve,reject)=>{
 const socket=net.createConnection({host:this.host,port:this.port});let settled=false;let response=Buffer.alloc(0);
 const finish=(error?:Error,result?:'clean'|'infected')=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);socket.destroy();if(error)reject(error);else resolve(result!);};
 const abort=()=>finish(new Error('SCAN_ABORTED'));signal.addEventListener('abort',abort,{once:true});
 socket.setTimeout(12000,()=>finish(new Error('SCANNER_TIMEOUT')));
 socket.on('error',()=>finish(new Error('SCANNER_UNAVAILABLE')));
 socket.on('close',()=>{if(!settled)finish(new Error('SCANNER_INCOMPLETE_RESPONSE'));});
 socket.on('data',chunk=>{response=Buffer.concat([response,chunk]);if(response.length>1024){finish(new Error('SCANNER_INVALID_RESPONSE'));return;}
 if(response.includes(0)){const text=response.subarray(0,response.indexOf(0)).toString('utf8');if(text==='stream: OK')finish(undefined,'clean');else if(/^stream: .+ FOUND$/.test(text))finish(undefined,'infected');else finish(new Error('SCANNER_REJECTED'));}});
 socket.on('connect',async()=>{try{
 const write=(buffer:Uint8Array)=>new Promise<void>((done,failed)=>socket.write(buffer,error=>error?failed(error):done()));
 await write(Buffer.from('zINSTREAM\0'));
 for(let offset=0;offset<data.length;offset+=65536){if(settled)return;const chunk=data.subarray(offset,offset+65536);const size=Buffer.alloc(4);size.writeUInt32BE(chunk.length);await write(size);await write(chunk);}
 await write(Buffer.alloc(4));
 }catch{finish(new Error('SCANNER_UNAVAILABLE'));}});
 });
 }
}
