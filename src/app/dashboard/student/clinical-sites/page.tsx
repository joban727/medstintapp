"use client"

import React from "react"

type ClinicalSite = {
  id: string
  name: string
  address: string
  phone?: string
  email?: string
  type: string
  capacity: number
  specialties?: string[]
  isActive?: boolean
  totalRotations?: number
  activeRotations?: number
  availableCapacity?: number
}

export default function ClinicalSitesPage() {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [sites, setSites] = React.useState<ClinicalSite[]>([])

  React.useEffect(() => {
    const fetchSites = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch("/api/clinical-sites?includeStats=true&limit=50", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        })

        const data = await res.json()
        if (!res.ok || !data?.success) {
          setError(data?.error || "Failed to load clinical sites")
          setSites([])
          return
        }
        const items: ClinicalSite[] = data.data?.clinicalSites || []
        setSites(items)
      } catch (e: any) {
        setError(e?.message || "Unexpected error fetching clinical sites")
      } finally {
        setLoading(false)
      }
    }

    fetchSites()
  }, [])

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Clinical Sites</h1>
      <p className="text-sm text-gray-600">
        View available clinical sites associated with your school.
      </p>

      {loading && <div className="text-gray-700">Loading clinical sites…</div>}

      {error && !loading && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sites.length === 0 ? (
            <div className="col-span-full text-gray-700">No clinical sites found.</div>
          ) : (
            sites.map((site) => (
              <div
                key={site.id}
                className="rounded-lg border border-gray-200 p-4 shadow-sm bg-white"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium">{site.name}</h2>
                  <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                    {site.type}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{site.address}</p>
                <div className="mt-3 text-sm text-gray-700">
                  <div>Capacity: {site.capacity}</div>
                  {typeof site.availableCapacity === "number" && (
                    <div>Available: {site.availableCapacity}</div>
                  )}
                  {typeof site.activeRotations === "number" && (
                    <div>Active Rotations: {site.activeRotations}</div>
                  )}
                </div>
                {Array.isArray(site.specialties) && site.specialties.length > 0 && (
                  <div className="mt-3">
                    <span className="font-semibold text-gray-600 text-xs">Specialties:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {site.specialties.map((s) => (
                        <span
                          key={s}
                          className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700 text-xs"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
