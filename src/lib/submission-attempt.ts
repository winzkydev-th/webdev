export type SubmissionAttempt={hash:string;key:string};
export class PendingSubmissionChanged extends Error {constructor(){super('PENDING_SUBMISSION_CHANGED');}}
// Keep the original identity until success or an explicit "start another" action.
export function submissionAttempt(previous:SubmissionAttempt|null,hash:string,newKey:()=>string):SubmissionAttempt {
 if(previous&&previous.hash!==hash)throw new PendingSubmissionChanged();
 return previous??{hash,key:newKey()};
}
export function formText(value:FormDataEntryValue|null){return typeof value==='string'?value.trim().normalize('NFC'):'';}
