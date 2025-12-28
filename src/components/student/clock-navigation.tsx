import Link from "next/link"
import { Clock } from "lucide-react"

export default function ClockNavigation() {
    return (
        <nav className="fixed top-4 left-4 z-50">
            <div className="bg-white/80 dark:bg-black/80 backdrop-blur-sm rounded-lg p-2 shadow-lg">
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    <div className="flex gap-1">
                        <Link
                            href="/dashboard/student/clock-minimal"
                            className="px-3 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                        >
                            Minimal
                        </Link>
                        <Link
                            href="/dashboard/student/clock-ultra"
                            className="px-3 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                        >
                            Ultra
                        </Link>
                        <Link
                            href="/dashboard/student"
                            className="px-3 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                        >
                            Original
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    )
}