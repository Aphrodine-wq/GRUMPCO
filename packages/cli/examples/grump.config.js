// grump.config.js
// JavaScript configuration file for G-Rump CLI

module.exports = {
  // API Configuration
  apiUrl: process.env.GRUMP_API_URL || 'http://localhost:3000',
  apiKey: process.env.GRUMP_API_KEY,
  
  // UI Configuration
  theme: 'dark',
  defaultOutputDir: './output',
  
  // Custom color scheme
  colors: {
    primary: '#FF6B35',
    secondary: '#F7931E',
    error: '#FF4136'
  },
  
  // Feature flags
  features: {
    autoStream: false,
    cacheEnabled: true,
    progressIndicators: true
  },
  
  // Advanced settings
  retries: 3,
  timeout: 30000,
  
  // Cache configuration
  cache: {
    enabled: true,
    ttl: 3600000, // 1 hour in milliseconds
    directory: './.grump-cache'
  },
  
  // Lifecycle hooks
  onStart: (command) => {
    console.log(`Starting ${command}...`);
  },
  
  onComplete: (result) => {
    console.log('Done!');
  },
  
  onError: (error) => {
    console.error('Error:', error.message);
  }
};
