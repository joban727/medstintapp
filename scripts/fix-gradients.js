const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/styles/globals.css');

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Regex to find linear-gradient and fix the colors inside
    // This is a bit complex, so we'll do a simpler approach:
    // Find patterns that look like HSL numbers (e.g. "221 83.2% 53.3%") BUT are inside a gradient definition
    // Actually, we can just find any occurrence of "num num% num%" that is NOT wrapped in hsl() and wrap it.
    // But we need to be careful not to double wrap.

    // Pattern: space or start, digit+, space, digit+%, space, digit+%
    const hslPattern = /(?<!hsl\()(\b\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%)/g;

    // We only want to do this for lines containing "linear-gradient" or "radial-gradient"
    const lines = content.split('\n');
    const newLines = lines.map(line => {
        if (line.includes('gradient')) {
            return line.replace(hslPattern, 'hsl($1)');
        }
        return line;
    });

    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
    console.log('Successfully fixed gradients in globals.css');
} catch (err) {
    console.error('Error processing file:', err);
    process.exit(1);
}
