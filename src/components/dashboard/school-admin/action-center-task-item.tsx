"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowRight, CheckCircle2, FileText, AlertCircle, Clock, Check, X, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface Task {
    id: string
    title: string
    type: 'approval' | 'time-approval' | 'evaluation' | 'system'
    priority: 'high' | 'medium' | 'low'
    date: string
    description?: string
    entityId: string
    entityType: string
}

interface ActionCenterTaskItemProps {
    task: Task
    index: number
    onApprove?: (taskId: string, entityId: string, entityType: string) => void
    onDismiss?: (taskId: string, entityId: string, entityType: string) => void
    onView?: (taskId: string, entityId: string, entityType: string) => void
}

export function ActionCenterTaskItem({
    task,
    index,
    onApprove,
    onDismiss,
    onView
}: ActionCenterTaskItemProps) {
    const getTaskIcon = (type: Task['type']) => {
        switch (type) {
            case 'approval': return CheckCircle2
            case 'time-approval': return Clock
            case 'evaluation': return FileText
            case 'system': return AlertCircle
            default: return Clock
        }
    }

    const getTaskLink = (type: Task['type'], entityId: string) => {
        switch (type) {
            case 'approval':
                return `/dashboard/school-admin/approvals?highlight=${entityId}`
            case 'time-approval':
                return `/dashboard/school-admin/time-records?highlight=${entityId}`
            case 'evaluation':
                return `/dashboard/school-admin/students?highlight=${entityId}`
            default:
                return '/dashboard/school-admin'
        }
    }

    const getActionButtons = (type: Task['type']) => {
        switch (type) {
            case 'approval':
                return (
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onApprove?.(task.id, task.entityId, task.entityType)
                            }}
                        >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Approve
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onDismiss?.(task.id, task.entityId, task.entityType)
                            }}
                        >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Deny
                        </Button>
                    </div>
                )
            case 'time-approval':
                return (
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onApprove?.(task.id, task.entityId, task.entityType)
                            }}
                        >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Approve
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onDismiss?.(task.id, task.entityId, task.entityType)
                            }}
                        >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Reject
                        </Button>
                    </div>
                )
            case 'evaluation':
                return (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-3 bg-info/10 hover:bg-info/20 text-info border border-info/20"
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onView?.(task.id, task.entityId, task.entityType)
                        }}
                    >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Complete
                    </Button>
                )
            default:
                return (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-3 bg-warning/10 hover:bg-warning/20 text-warning border border-warning/20"
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onDismiss?.(task.id, task.entityId, task.entityType)
                        }}
                    >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Acknowledge
                    </Button>
                )
        }
    }

    const Icon = getTaskIcon(task.type)

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
        >
            <Link href={getTaskLink(task.type, task.entityId)} className="block group">
                <div
                    className={cn(
                        "relative flex flex-col gap-3 rounded-xl border p-4 transition-all duration-300",
                        "border-border/50 hover:bg-muted/50 hover:border-primary/20",
                        task.priority === 'high' && "border-l-4 border-l-destructive"
                    )}
                    style={{ backgroundColor: task.priority === 'high' ? 'hsl(var(--destructive) / 0.05)' : 'transparent' }}
                >
                    {/* Header Row */}
                    <div className="flex items-start gap-4">
                        <div className={cn(
                            "mt-0.5 p-2.5 rounded-xl transition-transform group-hover:scale-110",
                            task.priority === 'high'
                                ? "bg-destructive/10 text-destructive"
                                : task.type === 'approval'
                                    ? "bg-success/10 text-success"
                                    : task.type === 'time-approval'
                                        ? "bg-info/10 text-info"
                                        : "bg-primary/10 text-primary"
                        )}>
                            <Icon className="h-5 w-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className={cn(
                                    "text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider",
                                    task.priority === 'high'
                                        ? "bg-destructive/10 text-destructive border border-destructive/20"
                                        : task.priority === 'medium'
                                            ? "bg-warning/10 text-warning border border-warning/20"
                                            : "bg-info/10 text-info border border-info/20"
                                )}>
                                    {task.priority}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <Clock className="h-3 w-3" />
                                    {task.date}
                                </span>
                            </div>
                            <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                                {task.title}
                            </h4>
                            {task.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                    {task.description}
                                </p>
                            )}
                        </div>

                        <div className="opacity-0 group-hover:opacity-100 transition-opacity self-center">
                            <ArrowRight className="h-4 w-4 text-primary/50" />
                        </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                            Quick Actions
                        </span>
                        {getActionButtons(task.type)}
                    </div>
                </div>
            </Link>
        </motion.div>
    )
}
