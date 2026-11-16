import { Route, Routes } from 'react-router-dom'
import { Home } from '../pages/Home'
import { Profile } from '../pages/Profile'
import { Layout } from '../components/Layout'
import { Dashboard } from '../pages/Dashboard'
import { Catalog } from '../pages/Catalog'
import { Saved } from '../pages/Saved'

export function AppRoutes() {
  return (
    <Layout><Routes><Route path="/" element={<Home />} /><Route path="/dashboard" element={<Dashboard />} /><Route path="/catalogo" element={<Catalog />} /><Route path="/guardadas" element={<Saved />} /><Route path="/perfil" element={<Profile />} /></Routes></Layout>
  )
}
