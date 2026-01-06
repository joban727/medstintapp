"use client"

import { motion } from "framer-motion"
import { Search, Filter, Plus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface FilterGroup {
  label: string
  options: string[]
}

interface ActionBarProps {
  searchPlaceholder: string
  searchValue: string
  onSearchChange: (value: string) => void
  filterGroups: FilterGroup[]
  onFilterSelect?: (value: string) => void
  addButtonLabel?: string
  onAddClick?: () => void
}

const itemVariants = {
  hidden: {
    opacity: 0,
    y: -20,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
  },
} as const

export function ActionBar({
  searchPlaceholder,
  searchValue,
  onSearchChange,
  filterGroups,
  onFilterSelect,
  addButtonLabel,
  onAddClick,
}: ActionBarProps) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="p-4 bg-white/5 backdrop-blur-md border-white/10 rounded-xl border">
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:bg-white/10 focus:border-white/20"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="glass"
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-muted-foreground hover:text-white transition-colors flex-shrink-0"
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">Filter</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-black/80 backdrop-blur-xl border-white/10">
                {filterGroups.map((group, groupIndex) => (
                  <div key={groupIndex}>
                    {groupIndex > 0 && <DropdownMenuSeparator className="bg-white/10" />}
                    <DropdownMenuLabel className="text-muted-foreground">
                      {group.label}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10" />
                    {group.options.map((option, optionIndex) => (
                      <DropdownMenuItem
                        key={optionIndex}
                        className="text-muted-foreground focus:bg-white/10 focus:text-white cursor-pointer"
                        onClick={() => onFilterSelect?.(option)}
                      >
                        {option}
                      </DropdownMenuItem>
                    ))}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {addButtonLabel && onAddClick && (
            <Button
              variant="default"
              onClick={onAddClick}
              className="self-end sm:self-auto bg-theme-gradient text-white border-0"
            >
              <Plus className="w-4 h-4 mr-2" />
              {addButtonLabel}
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  )
}
