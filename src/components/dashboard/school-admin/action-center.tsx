"use client"

import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, CheckCircle2, AlertCircle, Clock, FileText, Sparkles, Bell, Filter } from "lucide-react"
import { GlassCard } from "@/components/ui/glass-card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ActionCenterTaskItem, type Task } from "./action-center-task-item"

interface ActionCenterProps {
    tasks: Task[]
    variant?: 'default' | 'prominent'
    onApprove?: (taskId: string) => void
    onDismiss?: (taskId: string) => void
    onView?: (taskId: string) => void
}

type FilterType = 'all' | 'high' | 'approval'

export function ActionCenter({
    tasks,
    variant = 'default',
    onApprove,
    onDismiss,
    onView
}: ActionCenterProps) {
    const [filter, setFilter] = useState<FilterType>('all')

    const highPriorityCount = tasks.filter(t => t.priority === 'high').length
    const isProminent = variant === 'prominent' || tasks.length > 0

    const filteredTasks = tasks.filter(task => {
        if (filter === 'all') return true
        if (filter === 'high') return task.priority === 'high'
        if (filter === 'approval') return task.type === 'approval'
        return true
    })

    // Empty state component
    const EmptyState = () => (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-12 text-center"
        >
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full" />
                <div className="relative p-4 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <Sparkles className="h-10 w-10 text-emerald-400" />
                </div>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">All Clear!</h3>
            <p className="text-indigo-200/60 max-w-[250px]">
                You're all caught up. No pending tasks require your attention.
            </p>
        </motion.div>
    )

    return (
        <GlassCard
            className={cn(
                "h-full flex flex-col overflow-hidden",
                isProminent && "bg-gradient-to-br from-slate-900/95 via-indigo-950/90 to-slate-900/95 border-indigo-500/30 shadow-2xl shadow-indigo-500/10"
            )}
            variant="premium"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6 px-6 pt-6">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        {highPriorityCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                            </span>
                        )}
                        <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30">
                            <Bell className="h-5 w-5 text-indigo-400" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Action Center</h2>
                        <p className="text-xs text-indigo-200/60 mt-0.5">
                            {tasks.length > 0
                                ? `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} pending`
                                : 'No pending tasks'}
                        </p>
                    </div>
                </div>

                {tasks.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "text-sm font-bold px-3 py-1.5 rounded-full",
                            highPriorityCount > 0
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                        )}>
                            {tasks.length}
                        </span>
                    </div>
                )}
            </div>

            {/* Filter Tabs */}
            {tasks.length > 0 && (
                <div className="flex gap-2 mb-4 px-6 overflow-x-auto pb-2 custom-scrollbar">
                    <button
                        onClick={() => setFilter('all')}
                        className={cn(
                            "text-xs px-4 py-2 rounded-full transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 font-medium",
                            filter === 'all'
                                ? "bg-white/20 text-white border border-white/20 shadow-lg"
                                : "bg-white/5 text-indigo-200 hover:bg-white/10 border border-transparent"
                        )}
                    >
                        <Filter className="h-3 w-3" />
                        All
                    </button>
                    <button
                        onClick={() => setFilter('high')}
                        className={cn(
                            "text-xs px-4 py-2 rounded-full transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 font-medium",
                            filter === 'high'
                                ? "bg-rose-500/30 text-rose-200 border border-rose-500/30 shadow-lg shadow-rose-500/10"
                                : "bg-white/5 text-indigo-200 hover:bg-white/10 border border-transparent"
                        )}
                    >
                        <AlertCircle className="h-3 w-3" />
                        Urgent
                    </button>
                    <button
                        onClick={() => setFilter('approval')}
                        className={cn(
                            "text-xs px-4 py-2 rounded-full transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 font-medium",
                            filter === 'approval'
                                ? "bg-emerald-500/30 text-emerald-200 border border-emerald-500/30 shadow-lg shadow-emerald-500/10"
                                : "bg-white/5 text-indigo-200 hover:bg-white/10 border border-transparent"
                        )}
                    >
                        <CheckCircle2 className="h-3 w-3" />
                        Approvals
                    </button>
                </div>
            )}

            {/* Task List */}
            <div className="flex-1 space-y-3 overflow-y-auto px-6 pb-4 custom-scrollbar min-h-[200px]">
                {filteredTasks.length === 0 ? (
                    <EmptyState />
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
            {tasks.length > 0 && (
                <div className="px-6 pb-6 pt-4 border-t border-white/10">
                    <Link href="/dashboard/school-admin/approvals">
                        <Button
                            variant="ghost"
                            className="w-full justify-between text-indigo-200 hover:text-white hover:bg-white/5 group h-11"
                        >
                            <span className="flex items-center gap-2">
                                <Bell className="h-4 w-4" />
                                View all pending actions
                            </span>
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                    </Link>
                </div>
            )}
        </GlassCard>
    )
}
