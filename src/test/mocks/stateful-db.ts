import { vi } from 'vitest'

type TableName = string
type RecordId = string
type TableData = Record<RecordId, any>
type DBState = Record<TableName, TableData>

export class StatefulDBMock {
    private state: DBState = {}
    private tableMap = new Map<any, string>()
    public instanceId = Math.random().toString(36).substring(7)

    constructor() {
        console.log(`[MockDB] Constructor called. Instance ID: ${this.instanceId}`)
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
        console.log('[MockDB] getTableName called for:', table)
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
        if (table && table.name) {
            return table.name
        }

        // 4. Try to find any property that looks like a name
        if (table && typeof table === 'object') {
            // 5. Try Drizzle Symbols
            const symbols = Object.getOwnPropertySymbols(table)
            const baseNameSym = symbols.find(s => s.description === 'drizzle:BaseName')
            if (baseNameSym) {
                return table[baseNameSym] as string
            }

            const nameSym = symbols.find(s => s.description === 'drizzle:Name')
            if (nameSym) {
                return table[nameSym] as string
            }
        }

        console.warn('[MockDB] Could not resolve table name for:', table)
        return 'unknown_table'
    }

    // Helper to resolve column name
    private getColumnName(col: any): string | undefined {
        if (!col) return undefined;
        if (typeof col === 'string') return col;
        if (col.name) return col.name;
        if (col._ && col._.name) return col._.name;

        console.log('[MockDB] Could not resolve column name for:', col)
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
        console.log(`[MockDB ${this.instanceId}] Inserting into table: ${tableName}`)

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
                console.log(`[MockDB] Selecting from table: ${tableName}`)

                let currentRows = Object.values(this.getTable(tableName))

                const queryBuilder = {
                    leftJoin: (table: any, condition: any) => {
                        // console.log(`[MockDB] Left joining ${this.getTableName(table)}`)
                        return queryBuilder
                    },
                    innerJoin: (table: any, condition: any) => {
                        // console.log(`[MockDB] Inner joining ${this.getTableName(table)}`)
                        return queryBuilder
                    },
                    where: (condition: any) => {
                        // Safe logging
                        if (condition) {
                            if (condition.left && condition.right) {
                                const colName = this.getColumnName(condition.left)

                                if (colName) {
                                    const camelName = colName.replace(/_([a-z])/g, (g: string) => g[1].toUpperCase())
                                    currentRows = currentRows.filter(row => {
                                        const val = row[colName] !== undefined ? row[colName] : row[camelName]
                                        return val === condition.right
                                    })
                                }
                            } else if (Array.isArray(condition)) {
                                // Handle simple AND: array of conditions
                                condition.forEach((cond: any) => {
                                    if (cond && cond.left && cond.right) {
                                        const colName = this.getColumnName(cond.left)
                                        // Try direct access (snake_case) or camelCase conversion
                                        if (colName) {
                                            const camelName = colName.replace(/_([a-z])/g, (g: string) => g[1].toUpperCase())
                                            currentRows = currentRows.filter(row => {
                                                const val = row[colName] !== undefined ? row[colName] : row[camelName]
                                                return val === cond.right
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
        console.log(`[MockDB] Updating table: ${tableName}`)

        let updateValues: any = {}

        return {
            set: (values: any) => {
                updateValues = values
                return {
                    where: (condition: any) => {
                        const tableData = this.getTable(tableName)

                        // Try to extract ID from condition
                        let idToUpdate: string | undefined

                        if (condition && condition.left && condition.right) {
                            const colName = this.getColumnName(condition.left)
                            if (colName === 'id') {
                                idToUpdate = condition.right
                            }
                        }
                        // Try parsing queryChunks
                        else if (condition && condition.queryChunks) {
                            const extracted = this.extractConditionFromChunks(condition)
                            if (extracted) {
                                const colName = this.getColumnName(extracted.left)
                                if (colName === 'id') {
                                    idToUpdate = extracted.right
                                }
                            }
                        }

                        let updatedRows: any[] = []

                        if (idToUpdate && tableData[idToUpdate]) {
                            const updatedRow = { ...tableData[idToUpdate], ...updateValues }
                            tableData[idToUpdate] = updatedRow
                            updatedRows.push(updatedRow)
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
        console.log(`[MockDB] Deleting from table: ${tableName}`)

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
