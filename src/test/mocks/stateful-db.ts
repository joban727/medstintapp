import { vi } from 'vitest'

type TableName = string
type RecordId = string
type TableData = Record<RecordId, any>
type DBState = Record<TableName, TableData>

interface DrizzleTable {
    _: {
        name: string
    }
    name?: string
    [key: symbol]: string
}

interface DrizzleColumn {
    name?: string
    _: {
        name: string
    }
    table?: DrizzleTable
}

interface QueryChunk {
    name?: string
    table?: DrizzleTable
    value?: any
    constructor: {
        name: string
    }
}

interface QueryCondition {
    left?: DrizzleColumn | QueryChunk
    right?: any
    queryChunks?: QueryChunk[]
}

export class StatefulDBMock {
    private state: DBState = {}
    private tableMap = new Map<any, string>()
    public instanceId = Math.random().toString(36).substring(7)

    constructor() {
        this.reset()
    }

    reset() {
        this.state = {}
        // We don't reset tableMap as registration is usually static/global
    }

    // Register a table object with a name
    registerTable(table: any, name: string) {
        this.tableMap.set(table, name)
    }

    // Helper to get or create table storage
    private getTable(name: string): TableData {
        if (!this.state[name]) {
            this.state[name] = {}
        }
        return this.state[name]
    }

    // Helper to resolve table name from Drizzle object
    private getTableName(table: any): string {
        if (typeof table === 'string') return table;

        // 1. Try registered map
        if (this.tableMap.has(table)) {
            return this.tableMap.get(table)!
        }

        // 2. Try internal Drizzle property
        if (table && table._ && table._.name) {
            return table._.name
        }

        // 3. Try standard name property
        if (table && table.name && typeof table.name === 'string') {
            return table.name
        }

        // 4. Try to find any property that looks like a name
        if (table && typeof table === 'object') {
            // 5. Try Drizzle Symbols
            const symbols = Object.getOwnPropertySymbols(table)
            const baseNameSym = symbols.find(s => s.description === 'drizzle:BaseName')
            if (baseNameSym) {
                return String(table[baseNameSym])
            }

            const nameSym = symbols.find(s => s.description === 'drizzle:Name')
            if (nameSym) {
                return String(table[nameSym])
            }
        }

        console.warn('[MockDB] Could not resolve table name for object:', table)
        return 'unknown_table'
    }

    // Helper to resolve column name
    private getColumnName(col: any): string | undefined {
        if (!col) return undefined;
        if (typeof col === 'string') return col;
        if (col.name) return col.name;
        if (col._ && col._.name) return col._.name;

        return undefined;
    }

    // Helper to extract condition from SQL chunks
    private extractConditionFromChunks(condition: any): { left: any, right: any } | null {
        if (!condition || !condition.queryChunks) return null;

        let left: any = null;
        let right: any = null;

        for (const chunk of condition.queryChunks) {
            // Check for Column (has name and table)
            if (chunk.name && chunk.table) {
                left = chunk;
            }
            // Check for Param (has value)
            else if (chunk.constructor && chunk.constructor.name === 'Param' && chunk.value !== undefined) {
                right = chunk.value;
            }
        }

        if (left && right !== undefined) {
            return { left, right };
        }
        return null;
    }

    // Mock for 'insert'
    insert(table: any) {
        const tableName = this.getTableName(table)

        return {
            values: (values: any) => {
                const rows = Array.isArray(values) ? values : [values]
                const insertedRows: any[] = []

                rows.forEach(row => {
                    // Auto-generate ID if not present (simple mock)
                    const id = row.id || `mock-id-${Math.random().toString(36).substr(2, 9)}`
                    const newRow = { ...row, id }
                    this.getTable(tableName)[id] = newRow
                    insertedRows.push(newRow)
                })

                return {
                    returning: () => Promise.resolve(insertedRows),
                    // If no returning is called, it's still a promise in Drizzle
                    then: (resolve: any) => Promise.resolve(insertedRows).then(resolve)
                }
            }
        }
    }

    // Mock for 'select'
    select(fields?: any) {
        return {
            from: (table: any) => {
                const tableName = this.getTableName(table)

                let currentRows = Object.values(this.getTable(tableName))

                const queryBuilder = {
                    leftJoin: (table: any, condition: any) => {
                        return queryBuilder
                    },
                    innerJoin: (table: any, condition: any) => {
                        return queryBuilder
                    },
                    where: (condition: any) => {
                        // Safe logging
                        if (condition) {
                            // Try to extract condition from chunks first
                            let left = condition.left
                            let right = condition.right

                            if (!left && condition.queryChunks) {
                                const extracted = this.extractConditionFromChunks(condition)
                                if (extracted) {
                                    left = extracted.left
                                    right = extracted.right
                                }
                            }

                            if (left && right !== undefined) {
                                const colName = this.getColumnName(left)

                                if (colName) {
                                    const camelName = colName.replace(/_([a-z])/g, (g: string) => g[1].toUpperCase())
                                    currentRows = currentRows.filter(row => {
                                        const val = row[colName] !== undefined ? row[colName] : row[camelName]
                                        return val === right
                                    })
                                }
                            } else if (Array.isArray(condition)) {
                                // Handle simple AND: array of conditions
                                condition.forEach((cond: any) => {
                                    let cLeft = cond.left
                                    let cRight = cond.right

                                    if (!cLeft && cond.queryChunks) {
                                        const extracted = this.extractConditionFromChunks(cond)
                                        if (extracted) {
                                            cLeft = extracted.left
                                            cRight = extracted.right
                                        }
                                    }

                                    if (cLeft && cRight !== undefined) {
                                        const colName = this.getColumnName(cLeft)
                                        // Try direct access (snake_case) or camelCase conversion
                                        if (colName) {
                                            const camelName = colName.replace(/_([a-z])/g, (g: string) => g[1].toUpperCase())
                                            currentRows = currentRows.filter(row => {
                                                const val = row[colName] !== undefined ? row[colName] : row[camelName]
                                                return val === cRight
                                            })
                                        }
                                    }
                                })
                            }
                        }

                        return queryBuilder
                    },
                    limit: (n: number) => {
                        currentRows = currentRows.slice(0, n)
                        return queryBuilder
                    },
                    orderBy: () => queryBuilder,
                    offset: (n: number) => {
                        // offset support
                        return queryBuilder
                    },
                    then: (resolve: any) => Promise.resolve(currentRows).then(resolve)
                }
                return queryBuilder
            }
        }
    }

    // Mock for 'update'
    update(table: any) {
        const tableName = this.getTableName(table)

        let updateValues: any = {}

        return {
            set: (values: any) => {
                updateValues = values
                return {
                    where: (condition: any) => {
                        const tableData = this.getTable(tableName)

                        // Try to extract ID from condition
                        let idToUpdate: string | undefined

                        const extractId = (cond: any): string | undefined => {
                            if (!cond) return undefined

                            // Direct column comparison
                            if (cond.left && cond.right) {
                                const colName = this.getColumnName(cond.left)
                                if (colName === 'id') {
                                    return cond.right
                                }
                            }

                            // Query chunks
                            if (cond.queryChunks) {
                                const extracted = this.extractConditionFromChunks(cond)
                                if (extracted) {
                                    const colName = this.getColumnName(extracted.left)
                                    if (colName === 'id') {
                                        return extracted.right
                                    }
                                }
                                // Recursively check chunks if they are conditions
                                for (const chunk of cond.queryChunks) {
                                    const id = extractId(chunk)
                                    if (id) return id
                                }
                            }

                            // Array of conditions (AND)
                            if (Array.isArray(cond)) {
                                for (const c of cond) {
                                    const id = extractId(c)
                                    if (id) return id
                                }
                            }

                            return undefined
                        }

                        idToUpdate = extractId(condition)

                        let updatedRows: any[] = []

                        if (idToUpdate && tableData[idToUpdate]) {
                            // Update by ID
                            const updatedRow = { ...tableData[idToUpdate], ...updateValues }
                            tableData[idToUpdate] = updatedRow
                            updatedRows.push(updatedRow)
                        } else {
                            // Update by other conditions (scan all rows)
                            // This is a simplified implementation that only handles simple equality checks found in extractId logic
                            // For a full implementation, we would need a proper query engine.
                            // Here we assume if extractId didn't find 'id', we might need to search.

                            // Let's try to extract the column and value from the condition to filter
                            const extractFilter = (cond: any): { col: string, val: any } | undefined => {
                                if (!cond) return undefined
                                if (cond.left && cond.right) {
                                    const colName = this.getColumnName(cond.left)
                                    if (colName) return { col: colName, val: cond.right }
                                }
                                // Handle AND/Chunks - just take the first one for now as a best effort
                                if (cond.queryChunks) {
                                    const extracted = this.extractConditionFromChunks(cond)
                                    if (extracted) {
                                        const colName = this.getColumnName(extracted.left)
                                        if (colName) return { col: colName, val: extracted.right }
                                    }
                                }
                                return undefined
                            }

                            const filter = extractFilter(condition)
                            if (filter) {
                                Object.values(tableData).forEach((row: any) => {
                                    // Check snake_case or camelCase
                                    const val = row[filter.col] !== undefined ? row[filter.col] : row[filter.col.replace(/_([a-z])/g, (g: string) => g[1].toUpperCase())]
                                    if (val === filter.val) {
                                        const updatedRow = { ...row, ...updateValues }
                                        tableData[row.id] = updatedRow
                                        updatedRows.push(updatedRow)
                                    }
                                })
                            }
                        }

                        return {
                            returning: () => Promise.resolve(updatedRows),
                            then: (resolve: any) => Promise.resolve(updatedRows).then(resolve)
                        }
                    }
                }
            }
        }
    }
    // Mock for 'delete'
    delete(table: any) {
        const tableName = this.getTableName(table)

        return {
            where: (condition: any) => {
                const tableData = this.getTable(tableName)
                let idToDelete: string | undefined

                if (condition && condition.left && condition.right) {
                    const colName = this.getColumnName(condition.left)
                    if (colName === 'id') {
                        idToDelete = condition.right
                    }
                }
                // Try parsing queryChunks
                else if (condition && condition.queryChunks) {
                    const extracted = this.extractConditionFromChunks(condition)
                    if (extracted) {
                        const colName = this.getColumnName(extracted.left)
                        if (colName === 'id') {
                            idToDelete = extracted.right
                        }
                    }
                }

                if (idToDelete && tableData[idToDelete]) {
                    delete tableData[idToDelete]
                    return {
                        returning: () => Promise.resolve([{ id: idToDelete }]), // Return deleted ID/row
                        then: (resolve: any) => Promise.resolve([{ id: idToDelete }]).then(resolve)
                    }
                }

                return {
                    returning: () => Promise.resolve([]),
                    then: (resolve: any) => Promise.resolve([]).then(resolve)
                }
            }
        }
    }

    // Helper to inspect state in tests
    getAll(tableName: string) {
        return Object.values(this.getTable(tableName))
    }

    getById(tableName: string, id: string) {
        return this.getTable(tableName)[id]
    }
}

export const dbMock = new StatefulDBMock()
