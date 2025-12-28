import type React from 'react'
import { Button } from '@/components/ui/button'
import {
    Clock,
    Target,
    FileText,
    Calendar,
    MapPin,
    BarChart3,
    Users,
    Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickActionButtonProps {
    icon: React.ElementType
    label: string
    onClick: () => void
    variant?: 'default' | 'outline' | 'secondary'
    className?: string
    badge?: number
    disabled?: boolean
}

function QuickActionButton({
    icon: Icon,
    label,
    onClick,
    variant = 'outline',
    className = '',
    badge,
    disabled = false,
}: QuickActionButtonProps) {
    return (
        <Button
            variant={variant}
            size="lg"
            className={cn(
                'h-20 flex flex-col items-center justify-center gap-2 p-3 relative',
                'text-sm font-medium transition-all duration-200',
                'hover:scale-105 active:scale-95',
                'touch-manipulation select-none',
                className
            )}
            onClick={onClick}
            disabled={disabled}
        >
            <div className="relative">
                <Icon className="h-6 w-6" />
                {badge !== undefined && badge > 0 && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {badge > 99 ? '99+' : badge}
                    </div>
                )}
            </div>
            <span className="text-xs">{label}</span>
        </Button>
    )
}

interface MobileQuickActionsProps {
    onNavigate: (section: string) => void
    pendingEvaluations?: number
    pendingCompetencies?: number
    className?: string
}

export function MobileQuickActions({
    onNavigate,
    pendingEvaluations = 0,
    pendingCompetencies = 0,
    className = '',
}: MobileQuickActionsProps) {
    const actions = [
        {
            id: 'clock',
            icon: Clock,
            label: 'Clock In/Out',
            variant: 'default' as const,
            className:
                'bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700',
        },
        {
            id: 'competencies',
            icon: Target,
            label: 'Competencies',
            badge: pendingCompetencies,
        },
        {
            id: 'evaluations',
            icon: FileText,
            label: 'Evaluations',
            badge: pendingEvaluations,
        },
        { id: 'schedule', icon: Calendar, label: 'Schedule' },
        { id: 'sites', icon: MapPin, label: 'Sites' },
        { id: 'analytics', icon: BarChart3, label: 'Analytics' },
        { id: 'team', icon: Users, label: 'Team' },
        { id: 'settings', icon: Settings, label: 'Settings' },
    ]

    return (
        <div className={cn('p-4', className)}>
            <h2 className="text-lg font-semibold mb-4 text-foreground">
                Quick Actions
            </h2>
            <div className="grid grid-cols-4 gap-3">
                {actions.map((action) => (
                    <QuickActionButton
                        key={action.id}
                        icon={action.icon}
                        label={action.label}
                        variant={action.variant}
                        className={action.className}
                        badge={action.badge}
                        onClick={() => onNavigate(action.id)}
                    />
                ))}
            </div>
        </div>
    )
}

export function MobileQuickActionsCompact({
    onNavigate,
    pendingEvaluations = 0,
    pendingCompetencies = 0,
    className = '',
}: MobileQuickActionsProps) {
    const primaryActions = [
        {
            id: 'clock',
            icon: Clock,
            label: 'Clock In',
            variant: 'default' as const,
            className:
                'bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700',
        },
        {
            id: 'competencies',
            icon: Target,
            label: 'Competencies',
            badge: pendingCompetencies,
        },
        {
            id: 'evaluations',
            icon: FileText,
            label: 'Evaluations',
            badge: pendingEvaluations,
        },
        { id: 'schedule', icon: Calendar, label: 'Schedule' },
    ]

    return (
        <div className={cn('p-3', className)}>
            <div className="grid grid-cols-4 gap-2">
                {primaryActions.map((action) => (
                    <QuickActionButton
                        key={action.id}
                        icon={action.icon}
                        label={action.label}
                        variant={action.variant}
                        className={cn(action.className, 'h-16 text-xs')}
                        badge={action.badge}
                        onClick={() => onNavigate(action.id)}
                    />
                ))}
            </div>
        </div>
    )
}