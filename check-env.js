/**
 * Check environment variables for LLM keys
 * Run with: node check-env.js
 */

const fs = require('fs');

console.log('=== Checking LLM API Keys ===\n');

// Check .env file
console.log('Checking .env file:');
try {
  const envContent = fs.readFileSync('.env', 'utf8');
  const geminiMatch = envContent.match(/GEMINI_API_KEY=(.+)/);
  const openrouterMatch = envContent.match(/OPENROUTER_API_KEY=(.+)/);
  
  console.log('GEMINI_API_KEY:', geminiMatch ? (geminiMatch[1].trim() ? `SET (${geminiMatch[1].trim().length} chars)` : 'EMPTY') : 'NOT FOUND');
  console.log('OPENROUTER_API_KEY:', openrouterMatch ? (openrouterMatch[1].trim() ? `SET (${openrouterMatch[1].trim().length} chars)` : 'EMPTY') : 'NOT FOUND');
} catch (err) {
  console.log('Error reading .env:', err.message);
}

console.log('\nChecking .env.local file:');
try {
  const envLocalContent = fs.readFileSync('.env.local', 'utf8');
  const geminiMatch = envLocalContent.match(/GEMINI_API_KEY=(.+)/);
  const openrouterMatch = envLocalContent.match(/OPENROUTER_API_KEY=(.+)/);
  
  console.log('GEMINI_API_KEY:', geminiMatch ? (geminiMatch[1].trim() ? `SET (${geminiMatch[1].trim().length} chars)` : 'EMPTY') : 'NOT FOUND');
  console.log('OPENROUTER_API_KEY:', openrouterMatch ? (openrouterMatch[1].trim() ? `SET (${openrouterMatch[1].trim().length} chars)` : 'EMPTY') : 'NOT FOUND');
} catch (err) {
  console.log('Error reading .env.local:', err.message);
}

console.log('\n=== Solution ===');
console.log('To fix image recognition, you need to add an LLM API key to .env.local:');
console.log('');
console.log('Option 1 - Google Gemini (Recommended, Free tier available):');
console.log('  1. Go to https://makersuite.google.com/app/apikey');
console.log('  2. Create an API key');
console.log('  3. Add to .env.local: GEMINI_API_KEY=your-key-here');
console.log('');
console.log('Option 2 - OpenRouter (Paid, supports multiple models):');
console.log('  1. Go to https://openrouter.ai/keys');
console.log('  2. Create an API key');
console.log('  3. Add to .env.local: OPENROUTER_API_KEY=your-key-here');
console.log('');
console.log('After adding the key:');
console.log('  1. Restart your development server');
console.log('  2. If deployed to Vercel, add the key to your Vercel environment variables');
console.log('  3. Redeploy your app');
