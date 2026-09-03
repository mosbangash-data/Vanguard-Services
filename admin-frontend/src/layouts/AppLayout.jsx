import React from 'react'
import { AdminLayout } from './AdminLayout'

export function AppLayout({ title, navigation }) {
  return <AdminLayout customNavigation={navigation} pageTitleOverride={title} />
}
