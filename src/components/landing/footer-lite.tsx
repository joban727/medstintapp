import Image from "next/image"

export const FooterLite = () => {
  return (
    <footer className="border-t border-border">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo-medstint.svg" alt="MedStint Logo" width={24} height={24} className="h-6 w-6" />
            <span className="text-sm text-muted-foreground">© 2024 MedStint. All rights reserved.</span>
          </div>
          <p className="text-muted-foreground text-sm">HIPAA-compliant • WCAG AA</p>
        </div>
      </div>
    </footer>
  )
}
