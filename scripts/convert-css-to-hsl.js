const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/styles/globals.css');

function hexToHSL(hex) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = "0x" + hex[1] + hex[1];
        g = "0x" + hex[2] + hex[2];
        b = "0x" + hex[3] + hex[3];
    } else if (hex.length === 7) {
        r = "0x" + hex[1] + hex[2];
        g = "0x" + hex[3] + hex[4];
        b = "0x" + hex[5] + hex[6];
    }
    r = +r / 255;
    g = +g / 255;
    b = +b / 255;

    let cmin = Math.min(r, g, b),
        cmax = Math.max(r, g, b),
        delta = cmax - cmin,
        h = 0,
        s = 0,
        l = 0;

    if (delta === 0)
        h = 0;
    else if (cmax === r)
        h = ((g - b) / delta) % 6;
    else if (cmax === g)
        h = (b - r) / delta + 2;
    else
        h = (r - g) / delta + 4;

    h = Math.round(h * 60);

    if (h < 0)
        h += 360;

    l = (cmax + cmin) / 2;
    s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);

    return `${h} ${s}% ${l}%`;
}

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Regex to find hex colors
    const hexRegex = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;

    const newContent = content.replace(hexRegex, (match) => {
        // Skip if it's inside a url() or something else (simple check)
        return hexToHSL(match);
    });

    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('Successfully converted hex colors to HSL in globals.css');
} catch (err) {
    console.error('Error processing file:', err);
    process.exit(1);
}
