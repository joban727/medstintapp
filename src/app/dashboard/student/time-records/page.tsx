import TimeRecordsHistory from "@/components/student/time-records-history"
import { PageContainer, PageHeader } from "@/components/ui/page-container"

export default function StudentTimeRecordsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Time Records"
        description="View and filter your recent and historical time records."
      />
      <TimeRecordsHistory />
    </PageContainer>
  )
}
