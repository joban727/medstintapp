import { Clock } from "lucide-react"

interface ClockLoadingProps {
  theme?: "minimal" | "ultra"
}

export default function ClockLoading({ theme = "minimal" }: ClockLoadingProps) {
  const themeStyles = {
    minimal: {
      container: "bg-white dark:bg-gray-900",
      text: "text-gray-900 dark:text-white",
      subtext: "text-gray-600 dark:text-gray-300",
    },
    ultra: {
      container: "bg-white dark:bg-black",
      text: "text-black dark:text-white",
      subtext: "text-gray-700 dark:text-gray-300",
    },
  }

  const currentTheme = themeStyles[theme]

  return (
    <div className={`min-h-screen ${currentTheme.container} transition-colors duration-300`}>
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Clock className={`h-8 w-8 ${currentTheme.subtext} animate-pulse`} />
          </div>
          <div
            className={`text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-light ${currentTheme.text} animate-pulse`}
          >
            00:00:00
          </div>
        </div>
        <div className="mt-6 text-center">
          <div className={`text-lg md:text-xl font-light ${currentTheme.subtext} animate-pulse`}>
            Loading...
          </div>
        </div>
      </div>
    </div>
  )
}
