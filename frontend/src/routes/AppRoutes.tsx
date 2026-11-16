import { Navigate, Route, Routes } from 'react-router-dom'
import { Home } from '../pages/Home'
import { Profile } from '../pages/Profile'
import { Layout } from '../components/Layout'
import { Catalog } from '../pages/Catalog'

export function AppRoutes() {
  return (
    <Layout><Routes><Route path="/" element={<Home />} /><Route path="/dashboard" element={<Navigate to="/" replace />} /><Route path="/catalogo" element={<Catalog />} /><Route path="/guardadas" element={<Navigate to="/" replace />} /><Route path="/perfil" element={<Profile />} /></Routes></Layout>
  )
}
