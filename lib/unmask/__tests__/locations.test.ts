import test from 'node:test';
import assert from 'node:assert/strict';
import {countries,statesFor} from '../../locations';
test('location selector has real country-dependent subdivisions',()=>{
 assert.ok(countries.some(c=>c.name==='Nigeria'&&c.isoCode==='NG'));
 assert.ok(statesFor('NG').some(s=>s.name==='Edo'));
 assert.ok(statesFor('US').some(s=>s.name==='California'));
 assert.ok(!statesFor('NG').some(s=>s.name==='California'));
 assert.deepEqual(statesFor('invalid'),[]);
});
