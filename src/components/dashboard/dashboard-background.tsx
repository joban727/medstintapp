"use client"

import React from "react"

export function DashboardBackground() {
    return (
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-[hsl(var(--medical-primary)/0.12)] blur-[100px]" />
            <div className="absolute top-[20%] right-[-5%] h-[400px] w-[400px] rounded-full bg-[hsl(var(--medical-teal)/0.10)] blur-[80px]" />
            <div className="absolute bottom-[-10%] left-[30%] h-[400px] w-[400px] rounded-full bg-[hsl(var(--healthcare-green)/0.08)] blur-[100px]" />
        </div>
    )
}
