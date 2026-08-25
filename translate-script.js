import fs from 'fs';
import translate from 'google-translate-api-x';

const files = [
  'd:/NutriPalm-AI/src/components/DashboardPreview.tsx'
];

const enPath = 'd:/NutriPalm-AI/src/translation/translations/en.json';
const knPath = 'd:/NutriPalm-AI/src/translation/translations/kn.json';

// Read JSON files
let enJson = JSON.parse(fs.readFileSync(enPath, 'utf8'));
let knJson = JSON.parse(fs.readFileSync(knPath, 'utf8'));

// Regex to find literal strings wrapped in t()
const tRegex = /t\((['"])([^'"]+)\1\)/g;

function generateKey(filename, text) {
  const baseName = filename.split('/').pop().toLowerCase().replace('.tsx', '');
  const simplified = text
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .split(' ')
    .slice(0, 4)
    .join('_')
    .toLowerCase();
  let key = `${baseName}.${simplified}`;
  
  // ensure uniqueness if the base key already exists with a different value
  let finalKey = key;
  let counter = 1;
  while (enJson[finalKey] && enJson[finalKey] !== text) {
    finalKey = `${key}_${counter}`;
    counter++;
  }
  return finalKey;
}

async function processFiles() {
  let newTranslations = [];
  
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let matches = [...content.matchAll(tRegex)];
    
    let modified = false;
    for (const match of matches) {
      const quote = match[1];
      const text = match[2];
      
      // If it looks like a key (e.g. settingsscreen.something), skip
      if (/^[a-z0-9_]+\.[a-z0-9_]+$/.test(text)) {
        continue;
      }
      // If it contains spaces or uppercase, it's likely a literal string
      if (text.includes(' ') || /[A-Z]/.test(text)) {
        const newKey = generateKey(file, text);
        
        // Add to enJson
        if (!enJson[newKey]) {
          enJson[newKey] = text;
          newTranslations.push({ key: newKey, text });
        }
        
        // Replace in file
        content = content.replace(match[0], `t('${newKey}')`);
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Updated ${file}`);
    }
  }
  
  // Translate missing ones to kn
  console.log(`Found ${newTranslations.length} new translations to process.`);
  
  for (let i = 0; i < newTranslations.length; i++) {
    const item = newTranslations[i];
    if (!knJson[item.key]) {
      try {
        const res = await translate(item.text, { to: 'kn' });
        knJson[item.key] = res.text;
        console.log(`Translated [${i+1}/${newTranslations.length}]: ${item.text} -> ${res.text}`);
      } catch (err) {
        console.error(`Failed to translate: ${item.text}`, err);
        knJson[item.key] = item.text; // fallback
      }
    }
  }
  
  fs.writeFileSync(enPath, JSON.stringify(enJson, null, 2), 'utf8');
  fs.writeFileSync(knPath, JSON.stringify(knJson, null, 2), 'utf8');
  
  console.log("Done updating translations!");
}

processFiles().catch(console.error);
