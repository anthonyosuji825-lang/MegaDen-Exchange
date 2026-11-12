import AnnouncementPopup from '@/components/AnnouncementPopup'

export default function DashboardLayout({ children }) {
  return (
    <>
      {children}
      <AnnouncementPopup />
    </>
  )
}