import { test } from 'node:test';
import assert from 'node:assert/strict';
import { durablePhoto, readPhoto, PhotoUnavailableError } from '../photos';

test('photo data remains uploadable after draft serialization', async () => {
  const uri = 'data:image/png;base64,aGVsbG8=';
  const draft = JSON.parse(JSON.stringify({ photo: await durablePhoto(uri) }));
  assert.equal(await (await readPhoto(draft.photo)).text(), 'hello');
});

test('expired browser photo gives an actionable recovery message', async () => {
  const uri = URL.createObjectURL(new Blob(['photo'], { type: 'image/jpeg' }));
  URL.revokeObjectURL(uri);
  await assert.rejects(readPhoto(uri), (error: unknown) => {
    assert.ok(error instanceof PhotoUnavailableError);
    assert.match(error.message, /continue without it.*written draft is safe/);
    return true;
  });
});

test('native file URIs are not converted by the browser helper', async () => {
  assert.equal(await durablePhoto('file:///camera/photo.jpg'), 'file:///camera/photo.jpg');
});
