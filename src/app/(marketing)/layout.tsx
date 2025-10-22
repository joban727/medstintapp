import { Navbar } from "../../components/layout/navbar"
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Navbar />
      {children}
    </div>
  )
}
