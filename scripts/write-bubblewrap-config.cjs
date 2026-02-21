const fs = require('fs');
const os = require('os');
const path = require('path');

const configDir = path.join(os.homedir(), '.bubblewrap');
const configFile = path.join(configDir, 'config.json');

fs.mkdirSync(configDir, { recursive: true });

const config = {
  jdkPath: 'C:\\Program Files\\Microsoft\\jdk-17.0.16.8-hotspot',
  androidSdkPath: 'C:\\Users\\Admin\\AppData\\Local\\Android\\Sdk',
};

fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
console.log('Written to:', configFile);
console.log(fs.readFileSync(configFile, 'utf8'));

// Validate
const parsed = JSON.parse(fs.readFileSync(configFile, 'utf8'));
console.log('Parsed jdkPath:', parsed.jdkPath);
console.log('Parsed androidSdkPath:', parsed.androidSdkPath);
