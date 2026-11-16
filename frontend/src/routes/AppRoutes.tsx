import { Route, Routes } from 'react-router-dom'
import { Home } from '../pages/Home'
import { Profile } from '../pages/Profile'
import { Layout } from '../components/Layout'

export function AppRoutes() {
  return (
    <Layout><Routes><Route path="/" element={<Home />} /><Route path="/perfil" element={<Profile />} /></Routes></Layout>
  )
}
