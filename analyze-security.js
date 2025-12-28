const fs = require('fs');

try {
    const content = fs.readFileSync('eslint-results.json', 'utf16le').replace(/^\uFEFF/, '');
    const results = JSON.parse(content);
    let count = 0;

    console.log('--- Security Analysis Results ---');
    results.forEach(file => {
        file.messages.forEach(msg => {
            if (msg.ruleId && msg.ruleId.includes('security')) {
                console.log(`File: ${file.filePath}`);
                console.log(`Line: ${msg.line}`);
                console.log(`Rule: ${msg.ruleId}`);
                console.log(`Message: ${msg.message}`);
                console.log('---');
                count++;
            }
        });
    });

    if (count === 0) {
        console.log('No security issues found.');
    } else {
        console.log(`Found ${count} security issues.`);
    }

} catch (e) {
    console.error('Error reading or parsing eslint-results.json:', e);
}
