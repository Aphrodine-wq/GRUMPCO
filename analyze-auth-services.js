const fs = require('fs');
const path = require('path');

console.log('🔍 Analyzing All Services Requiring Authentication...\n');

// Read frontend integrations metadata
const integrationsApiPath = path.join(__dirname, 'frontend/src/lib/integrationsApi.ts');
const integrationsContent = fs.readFileSync(integrationsApiPath, 'utf8');

// Extract provider metadata
const metadataMatch = integrationsContent.match(/export const PROVIDER_METADATA[\s\S]*?= \{([\s\S]*?)\n\};/);
if (!metadataMatch) {
  console.error('Could not find PROVIDER_METADATA');
  process.exit(1);
}

// Parse providers by auth type
const providers = {
  oauth: [],
  api_key: [],
  bot_token: [],
  local: []
};

const providerRegex = /(\w+):\s*\{[^}]*authType:\s*'(\w+)'/g;
let match;
while ((match = providerRegex.exec(metadataMatch[1])) !== null) {
  const [, name, authType] = match;
  providers[authType].push(name);
}

console.log('📊 Current Authentication Methods:\n');
console.log(`✅ OAuth (${providers.oauth.length} services):`);
providers.oauth.forEach(p => console.log(`   - ${p}`));

console.log(`\n🔑 API Key (${providers.api_key.length} services):`);
providers.api_key.forEach(p => console.log(`   - ${p}`));

console.log(`\n🤖 Bot Token (${providers.bot_token.length} services):`);
providers.bot_token.forEach(p => console.log(`   - ${p}`));

console.log(`\n💻 Local (${providers.local.length} services):`);
providers.local.forEach(p => console.log(`   - ${p}`));

// Research which API key services support OAuth
console.log('\n\n🔬 OAuth Support Research:\n');

const oauthSupport = {
  'home_assistant': { supports: false, reason: 'Local installation, uses long-lived access tokens' },
  'elevenlabs': { supports: false, reason: 'API key only' },
  'twilio': { supports: true, reason: 'Supports OAuth 2.0 for account access' },
  'sendgrid': { supports: false, reason: 'API key only (owned by Twilio)' },
  'stripe': { supports: true, reason: 'Stripe Connect OAuth for platform integrations' },
  'discord': { supports: true, reason: 'OAuth 2.0 for user authentication (bot token for bots)' },
  'obsidian': { supports: false, reason: 'Local app, no cloud OAuth' }
};

Object.entries(oauthSupport).forEach(([service, info]) => {
  const icon = info.supports ? '✅' : '❌';
  console.log(`${icon} ${service}: ${info.reason}`);
});

console.log('\n\n📋 Summary:\n');
console.log(`Total services: ${providers.oauth.length + providers.api_key.length + providers.bot_token.length + providers.local.length}`);
console.log(`Already OAuth: ${providers.oauth.length}`);
console.log(`Can add OAuth: 3 (Twilio, Stripe, Discord)`);
console.log(`Must stay API key: 3 (Home Assistant, ElevenLabs, SendGrid)`);
console.log(`Local only: 1 (Obsidian)`);
console.log(`Bot token: 1 (Discord - already has OAuth option)`);

console.log('\n\n🎯 Action Plan:\n');
console.log('1. Add OAuth for: Twilio, Stripe');
console.log('2. Add OAuth option for Discord (in addition to bot token)');
console.log('3. Keep API key for: Home Assistant, ElevenLabs, SendGrid');
console.log('4. Total OAuth providers after implementation: 14 (from 12)');

