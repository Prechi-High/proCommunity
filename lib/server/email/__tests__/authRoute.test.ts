import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
// Load the exact CommonJS function deployed by Vercel, without Metro/tsx resolving its imports.
const handler=require('../../../../api/auth/request-email-code.js');
function response(){let status=0,body:unknown;return {value:()=>({status,body}),setHeader(){},status(code:number){status=code;return{json(value:unknown){body=value;},send(value:unknown){body=value;}};}};}
test('deployed auth entry rejects invalid input without requiring credentials or sending mail',async()=>{const res=response();await handler({method:'POST',body:{email:'not-an-email'}},res);assert.equal(res.value().status,400);assert.deepEqual(res.value().body,{error:'Please enter a valid email address.'});});
test('deployed auth entry handles HTTP methods before auth dependencies',async()=>{const res=response();await handler({method:'GET'},res);assert.equal(res.value().status,405);});
