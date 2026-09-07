import { Routes, Route } from 'react-router-dom'
import PublicLayout from './layouts/PublicLayout'
import Home from './pages/Home'
import Transport from './pages/Transport'
import Construction from './pages/Construction'
import ProjectDetail from './pages/ProjectDetail'
import Automobile from './pages/Automobile'
import VehicleDetail from './pages/VehicleDetail'
import Contact from './pages/Contact'
import ConstructionAbout from './pages/ConstructionAbout'
import CoachAbout from './pages/CoachAbout'
import Agent from './pages/Agent'
import Ticket from './pages/Ticket'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/transport" element={<Transport />} />
        <Route path="/transport/about" element={<CoachAbout />} />
        <Route path="/construction" element={<Construction />} />
        <Route path="/construction/about" element={<ConstructionAbout />} />
        <Route path="/construction/projects/:id" element={<ProjectDetail />} />
        <Route path="/automobile" element={<Automobile />} />
        <Route path="/automobile/vehicles/:id" element={<VehicleDetail />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/tickets/:ticketCode" element={<Ticket />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      {/* Page Agent : redirection vers le login interne existant */}
      <Route path="/agent" element={<Agent />} />
    </Routes>
  )
}