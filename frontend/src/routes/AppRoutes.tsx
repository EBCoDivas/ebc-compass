import { ProfileSession } from '../components/ProfileSession'
import { sessionSubject } from '../services/session'
import { authConfigured, getToken } from '../services/authService'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Home } from '../pages/Home'
import { Profile } from '../pages/Profile'
import { Calendar } from '../pages/Calendar'
import { Assistant } from '../pages/Assistant'
import { SignIn } from '../pages/SignIn'
import { Layout } from '../components/Layout'
import { Catalog } from '../pages/Catalog'
import { Admin } from '../pages/Admin'
import { Requests } from '../pages/Requests'

export function AppRoutes() {
  return (
    <Layout>{authConfigured && !getToken() ? <Routes><Route path="/acceso" element={<SignIn />} /><Route path="*" element={<Navigate to="/acceso" replace />} /></Routes> : <ProfileSession key={sessionSubject() ?? 'anonymous'}><Routes><Route path="/" element={<Home />} /><Route path="/dashboard" element={<Navigate to="/" replace />} /><Route path="/catalogo" element={<Catalog />} /><Route path="/guardadas" element={<Navigate to="/" replace />} /><Route path="/calendario" element={<Calendar />} /><Route path="/asistente" element={<Assistant />} /><Route path="/acceso" element={<SignIn />} /><Route path="/perfil" element={<Profile />} /><Route path="/admin" element={<Admin />} /><Route path="/solicitudes" element={<Requests />} /></Routes></ProfileSession>}</Layout>
  )
}
