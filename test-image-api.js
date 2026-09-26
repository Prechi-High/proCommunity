/**
 * Test script for universal-search API
 * Run with: node test-image-api.js
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

console.log('Environment check:');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET (length: ' + process.env.GEMINI_API_KEY.length + ')' : 'NOT SET');
console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'SET (length: ' + process.env.OPENROUTER_API_KEY.length + ')' : 'NOT SET');
console.log('');

// Test with a small test image (1x1 pixel PNG)
const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

console.log('Testing /api/universal-search endpoint...');
console.log('');

// Import the handler
const handler = require('./api/universal-search.ts').default;

// Mock request and response objects
const mockReq = {
  method: 'POST',
  body: {
    imageBase64: testImageBase64,
    mimeType: 'image/png',
    fileName: 'test.png',
  },
};

const mockRes = {
  status: (code) => ({
    json: (body) => {
      console.log('Response Status:', code);
      console.log('Response Body:', JSON.stringify(body, null, 2));
    },
    send: (body) => {
      console.log('Response Status:', code);
      console.log('Response Body:', body);
    },
  }),
};

// Run the test
handler(mockReq, mockRes);
