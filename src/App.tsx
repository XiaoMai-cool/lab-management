import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

// Auth
import LoginPage from './pages/auth/LoginPage'

// Main pages
import Dashboard from './pages/Dashboard'

// Supplies
import SupplyList from './pages/supplies/SupplyList'
import SupplyReserve from './pages/supplies/SupplyReserve'
import MyReservations from './pages/supplies/MyReservations'
import ReservationReview from './pages/supplies/ReservationReview'

// Chemicals (legacy pages)
import ChemicalList from './pages/chemicals/ChemicalList'
import ChemicalLog from './pages/chemicals/ChemicalLog'
import ChemicalHistory from './pages/chemicals/ChemicalHistory'
import ChemicalPurchaseRequest from './pages/chemicals/ChemicalPurchaseRequest'

// Reagents (new full lifecycle)
import ReagentList from './pages/reagents/ReagentList'
import ReagentDetail from './pages/reagents/ReagentDetail'
import ReagentForm from './pages/reagents/ReagentForm'
import ReagentPurchaseRequest from './pages/reagents/ReagentPurchaseRequest'
import ReagentStockMovement from './pages/reagents/ReagentStockMovement'
import MyReagentLedger from './pages/reagents/MyReagentLedger'
import SupplierManage from './pages/reagents/SupplierManage'

// Documents
import DocumentList from './pages/documents/DocumentList'
import DocumentView from './pages/documents/DocumentView'
import DocumentEdit from './pages/documents/DocumentEdit'

// Duty & Equipment
import DutyRoster from './pages/duty/DutyRoster'
import EquipmentList from './pages/duty/EquipmentList'

// Meetings
import MeetingList from './pages/meetings/MeetingList'
import ProgressReport from './pages/meetings/ProgressReport'

// Reimbursements
import ReimbursementList from './pages/reimbursements/ReimbursementList'
import ReimbursementForm from './pages/reimbursements/ReimbursementForm'
import ReimbursementReview from './pages/reimbursements/ReimbursementReview'

// Profile
import ProfilePage from './pages/profile/ProfilePage'

// Admin
import AdminDashboard from './pages/admin/AdminDashboard'
import AnnouncementManage from './pages/admin/AnnouncementManage'
import MemberManage from './pages/admin/MemberManage'
import SupplyManage from './pages/admin/SupplyManage'
import DataExport from './pages/admin/DataExport'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes with layout */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            {/* Dashboard */}
            <Route path="/" element={<Dashboard />} />

            {/* Supplies */}
            <Route path="/supplies" element={<SupplyList />} />
            <Route path="/supplies/reserve" element={<SupplyReserve />} />
            <Route path="/supplies/my-reservations" element={<MyReservations />} />
            <Route path="/supplies/review" element={
              <ProtectedRoute requiredModule="supplies"><ReservationReview /></ProtectedRoute>
            } />

            {/* Reagents / Chemicals - new full lifecycle */}
            <Route path="/reagents" element={<ReagentList />} />
            <Route path="/reagents/new" element={
              <ProtectedRoute requiredModule="chemicals"><ReagentForm /></ProtectedRoute>
            } />
            <Route path="/reagents/:id" element={<ReagentDetail />} />
            <Route path="/reagents/:id/edit" element={
              <ProtectedRoute requiredModule="chemicals"><ReagentForm /></ProtectedRoute>
            } />
            <Route path="/reagents/purchase" element={<ReagentPurchaseRequest />} />
            <Route path="/reagents/stock" element={
              <ProtectedRoute requiredModule="chemicals"><ReagentStockMovement /></ProtectedRoute>
            } />
            <Route path="/reagents/my-ledger" element={<MyReagentLedger />} />
            <Route path="/reagents/suppliers" element={
              <ProtectedRoute requiredModule="chemicals"><SupplierManage /></ProtectedRoute>
            } />

            {/* Chemicals - legacy (redirect to new reagents) */}
            <Route path="/chemicals" element={<ReagentList />} />
            <Route path="/chemicals/log" element={<ChemicalLog />} />
            <Route path="/chemicals/history" element={<ChemicalHistory />} />
            <Route path="/chemicals/purchase" element={<ChemicalPurchaseRequest />} />

            {/* Documents */}
            <Route path="/documents" element={<DocumentList />} />
            <Route path="/documents/:id" element={<DocumentView />} />
            <Route path="/documents/new" element={
              <ProtectedRoute requiredRole="manager"><DocumentEdit /></ProtectedRoute>
            } />
            <Route path="/documents/:id/edit" element={
              <ProtectedRoute requiredRole="manager"><DocumentEdit /></ProtectedRoute>
            } />

            {/* Duty & Equipment */}
            <Route path="/duty" element={<DutyRoster />} />
            <Route path="/equipment" element={<EquipmentList />} />

            {/* Meetings */}
            <Route path="/meetings" element={<MeetingList />} />
            <Route path="/meetings/report" element={<ProgressReport />} />

            {/* Reimbursements */}
            <Route path="/reimbursements" element={<ReimbursementList />} />
            <Route path="/reimbursements/new" element={<ReimbursementForm />} />
            <Route path="/reimbursements/review" element={
              <ProtectedRoute requiredRole="admin"><ReimbursementReview /></ProtectedRoute>
            } />

            {/* Profile */}
            <Route path="/profile" element={<ProfilePage />} />

            {/* Admin */}
            <Route path="/admin" element={
              <ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>
            } />
            <Route path="/admin/announcements" element={
              <ProtectedRoute requiredRole="admin"><AnnouncementManage /></ProtectedRoute>
            } />
            <Route path="/admin/members" element={
              <ProtectedRoute requiredModule="members"><MemberManage /></ProtectedRoute>
            } />
            <Route path="/admin/supplies" element={
              <ProtectedRoute requiredModule="supplies"><SupplyManage /></ProtectedRoute>
            } />
            <Route path="/admin/export" element={
              <ProtectedRoute requiredRole="admin"><DataExport /></ProtectedRoute>
            } />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
