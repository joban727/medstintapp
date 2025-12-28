const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/styles/globals.css');

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Find the @theme inline block
    const themeStart = content.indexOf('@theme inline {');
    if (themeStart === -1) {
        console.error('Could not find @theme inline block');
        process.exit(1);
    }

    const beforeTheme = content.substring(0, themeStart);
    const themeContent = content.substring(themeStart);

    // Process lines inside the theme block
    // We want to wrap color variables in hsl()
    // Pattern: --color-xyz: var(--xyz);
    const newThemeContent = themeContent.replace(
        /(--color-[a-zA-Z0-9-]+):\s*var\((--[a-zA-Z0-9-]+)\);/g,
        '$1: hsl(var($2));'
    );

    fs.writeFileSync(filePath, beforeTheme + newThemeContent, 'utf8');
    console.log('Successfully fixed @theme inline in globals.css');
} catch (err) {
    console.error('Error processing file:', err);
    process.exit(1);
}
