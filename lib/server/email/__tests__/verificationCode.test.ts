import test from 'node:test';
import assert from 'node:assert/strict';
import { renderVerificationCodeEmail } from '../templates/verificationCode';
test('email renders in Node without importing image assets', () => {
 const html=renderVerificationCodeEmail({code:'123456'});
 assert.match(html,/123456/);assert.match(html,/Unmask/);assert.match(html,/Know before you buy/);
 assert.doesNotMatch(html,/<script/i);
});
test('email only accepts a six-digit code and escapes optional logo URLs',()=>{
 assert.throws(()=>renderVerificationCodeEmail({code:'<script>'}));
 const html=renderVerificationCodeEmail({code:'654321',logoUrl:'https://example.com/logo.png?x=" onclick="alert(1)'});
 assert.match(html,/&quot;/);assert.doesNotMatch(html,/src="[^"]*" onclick=/);
 assert.doesNotMatch(renderVerificationCodeEmail({code:'123456',logoUrl:'javascript:alert(1)'}),/javascript:/);
});
