import test from 'node:test';import assert from 'node:assert/strict';
import {inspectFile,maxFileBytes} from '../src/lib/attachments.ts';
const pdf=Buffer.from('%PDF-1.4\nSYNTHETIC TEST ONLY\n%%EOF');
test('attachment validation matches extension, declared MIME and signature',()=>{
 assert.equal(inspectFile('synthetic.pdf','application/pdf',pdf).mediaType,'application/pdf');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yD7sAAAAASUVORK5CYII=','base64');assert.equal(inspectFile('pixel.png','image/png',png).mediaType,'image/png');
 for(const [name,type,bytes] of [['../file.pdf','application/pdf',pdf],['file.pdf.exe','application/pdf',pdf],['file.pdf','image/png',pdf],['file.pdf','application/pdf',Buffer.from('<html>test</html>')],['file:payload.pdf','application/pdf',pdf],['file.pdf\r\nHeader','application/pdf',pdf],['file.pdf','application/pdf',new Uint8Array(maxFileBytes+1)]])assert.throws(()=>inspectFile(name,type,bytes));
});
