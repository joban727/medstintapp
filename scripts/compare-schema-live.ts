import * as drizzleSchema from '../src/database/schema';
import neonSchema from '../neon-schema.json';

function getTableName(table: any): string | null {
    const symbols = Object.getOwnPropertySymbols(table);
    const nameSymbol = symbols.find(s => s.toString() === 'Symbol(drizzle:BaseName)');
    if (nameSymbol) {
        return table[nameSymbol];
    }
    // Fallback: check for 'name' property if it exists and looks like a table name
    // But Drizzle tables don't usually have 'name' prop directly.
    return null;
}

function getTableColumns(table: any): Record<string, any> {
    const columns: Record<string, any> = {};
    for (const key of Object.keys(table)) {
        const val = table[key];
        if (val && typeof val === 'object' && 'name' in val && 'dataType' in val) {
            columns[key] = val;
        }
    }
    return columns;
}

function compareSchemas() {
    console.log('Starting schema comparison...');

    const drizzleTableMap = new Map<string, any>();

    for (const [key, value] of Object.entries(drizzleSchema)) {
        if (value && typeof value === 'object') {
            const tableName = getTableName(value);
            if (tableName) {
                drizzleTableMap.set(tableName, value);
            }
        }
    }

    console.log('Identified Drizzle Tables:', Array.from(drizzleTableMap.keys()));

    const report: string[] = [];
    report.push('# Schema Comparison Report\n');

    // 1. Check Drizzle Tables against Neon
    report.push('## Drizzle Tables vs Neon Database\n');

    for (const [tableName, tableObj] of drizzleTableMap.entries()) {
        const neonTable = (neonSchema as any)[tableName];

        if (!neonTable) {
            report.push(`- [MISSING IN NEON] Table '${tableName}' is defined in Drizzle but missing in Neon.`);
            continue;
        }

        const columns = getTableColumns(tableObj);
        const neonColumns = new Map(neonTable.map((c: any) => [c.name, c]));

        for (const [colKey, colObj] of Object.entries(columns)) {
            const colName = colObj.name; // This is the DB column name
            const neonCol = neonColumns.get(colName);

            if (!neonCol) {
                report.push(`- [MISSING COLUMN] Table '${tableName}': Column '${colName}' (field: ${colKey}) is missing in Neon.`);
            } else {
                // Optional: Check type
                // const drizzleType = colObj.dataType;
                // const neonType = neonCol.type;
                // if (drizzleType !== neonType) ...
            }
        }
    }

    // 2. Check Neon Tables against Drizzle
    report.push('\n## Neon Database vs Drizzle Schema\n');
    const drizzleTableNames = new Set(drizzleTableMap.keys());

    for (const tableName of Object.keys(neonSchema)) {
        if (!drizzleTableNames.has(tableName)) {
            if (tableName.startsWith('_')) continue; // Skip prisma migrations or system tables
            report.push(`- [MISSING IN DRIZZLE] Table '${tableName}' exists in Neon but is not defined in Drizzle.`);

            const cols = (neonSchema as any)[tableName].map((c: any) => c.name).join(', ');
            report.push(`  - Columns: ${cols}`);
        }
    }

    const fs = require('fs');
    const path = require('path');
    fs.writeFileSync(path.resolve(__dirname, '../schema-comparison-report.md'), report.join('\n'));
    console.log('Report saved to schema-comparison-report.md');
}

compareSchemas();
