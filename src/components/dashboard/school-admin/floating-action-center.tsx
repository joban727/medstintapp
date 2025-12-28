"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    Bell,
    X,
    ChevronUp,
    Sparkles,
    Filter
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ActionCenterTaskItem, type Task } from "./action-center-task-item"
import { GlassCard } from "@/components/ui/glass-card"

interface FloatingActionCenterProps {
    tasks: Task[]
    onApprove?: (taskId: string, entityId: string, entityType: string) => void
    onDismiss?: (taskId: string, entityId: string, entityType: string) => void
    onView?: (taskId: string, entityId: string, entityType: string) => void
}

type FilterType = 'all' | 'high' | 'approval'

export function FloatingActionCenter({
    tasks,
    onApprove,
    onDismiss,
    onView
}: FloatingActionCenterProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [filter, setFilter] = useState<FilterType>('all')
    const [isMinimized, setIsMinimized] = useState(false)

    const highPriorityCount = tasks.filter(t => t.priority === 'high').length
    const hasTasks = tasks.length > 0

    // Auto-expand when tasks arrive
    useEffect(() => {
        if (hasTasks && !isMinimized) {
            setIsExpanded(true)
        }
    }, [hasTasks, isMinimized])

    // Auto-collapse when no tasks
    useEffect(() => {
        if (!hasTasks) {
            setIsExpanded(false)
            setIsMinimized(false)
        }
    }, [hasTasks])

    const filteredTasks = tasks.filter(task => {
        if (filter === 'all') return true
        if (filter === 'high') return task.priority === 'high'
        if (filter === 'approval') return task.type === 'approval'
        return true
    })

    const handleToggle = () => {
        if (isExpanded) {
            setIsExpanded(false)
            setIsMinimized(true)
        } else {
            setIsExpanded(true)
            setIsMinimized(false)
        }
    }

    // Collapsed badge when no tasks or minimized
    if (!isExpanded) {
        return (
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="fixed bottom-6 right-6 z-50"
            >
                <button
                    onClick={handleToggle}
                    className={cn(
                        "relative p-4 rounded-2xl shadow-2xl transition-all duration-300",
                        "bg-primary hover:bg-primary/90",
                        "border border-primary/20 backdrop-blur-xl shadow-xl shadow-primary/20",
                        hasTasks && "animate-pulse"
                    )}
                >
                    <Bell className="h-6 w-6 text-white" />
                    {hasTasks && (
                        <span className="absolute -top-2 -right-2 flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-rose-500 text-white text-xs font-bold border-2 border-white shadow-lg">
                            {tasks.length}
                        </span>
                    )}
                    {highPriorityCount > 0 && (
                        <span className="absolute -top-1 -left-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                        </span>
                    )}
                </button>
            </motion.div>
        )
    }

    // Expanded popout panel
    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                onClick={handleToggle}
            />

            {/* Panel */}
            <motion.div
                initial={{ opacity: 0, y: 100, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 100, scale: 0.95 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-48px)] max-h-[70vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-border/50 bg-card/95 backdrop-blur-xl text-card-foreground"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            {highPriorityCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
                                </span>
                            )}
                            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                                <Bell className="h-5 w-5 text-primary" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-foreground">Action Center</h2>
                            <p className="text-xs text-muted-foreground">
                                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} pending
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleToggle}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 p-3 border-b border-border/50 bg-muted/30">
                    <button
                        onClick={() => setFilter('all')}
                        className={cn(
                            "text-xs px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 font-medium",
                            filter === 'all'
                                ? "bg-primary/15 text-foreground"
                                : "text-muted-foreground hover:bg-muted"
                        )}
                    >
                        <Filter className="h-3 w-3" />
                        All
                    </button>
                    <button
                        onClick={() => setFilter('high')}
                        className={cn(
                            "text-xs px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 font-medium",
                            filter === 'high'
                                ? "bg-destructive/10 text-destructive"
                                : "text-muted-foreground hover:bg-muted"
                        )}
                    >
                        <AlertCircle className="h-3 w-3" />
                        Urgent
                    </button>
                    <button
                        onClick={() => setFilter('approval')}
                        className={cn(
                            "text-xs px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 font-medium",
                            filter === 'approval'
                                ? "bg-medical-teal/10 text-medical-teal"
                                : "text-muted-foreground hover:bg-muted"
                        )}
                    >
                        <CheckCircle2 className="h-3 w-3" />
                        Approvals
                    </button>
                </div>

                {/* Task List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {filteredTasks.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center py-8 text-center"
                        >
                            <div className="relative mb-4">
                                <div className="absolute inset-0 bg-medical-teal/20 blur-xl rounded-full" />
                                <div className="relative p-3 rounded-full bg-medical-teal/10 border border-medical-teal/20">
                                    <Sparkles className="h-8 w-8 text-medical-teal" />
                                </div>
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-1">All Clear!</h3>
                            <p className="text-sm text-muted-foreground">No matching tasks</p>
                        </motion.div>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {filteredTasks.map((task, index) => (
                                <ActionCenterTaskItem
                                    key={task.id}
                                    task={task}
                                    index={index}
                                    onApprove={onApprove}
                                    onDismiss={onDismiss}
                                    onView={onView}
                                />
                            ))}
                        </AnimatePresence>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-border/50 bg-muted/30">
                    <Link href="/dashboard/school-admin/approvals">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between text-muted-foreground hover:text-foreground hover:bg-muted group"
                        >
                            <span>View all pending items</span>
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                    </Link>
                </div>
            </motion.div>
        </>
    )
}
