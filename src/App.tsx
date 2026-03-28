import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import LoadingSpinner from './components/LoadingSpinner'

// 按需加载：只有用户访问某个页面时才下载对应代码
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const Dashboard = lazy(() => import('./pages/Dashboard'))

// Supplies
const SupplyList = lazy(() => import('./pages/supplies/SupplyList'))
const SupplyReserve = lazy(() => import('./pages/supplies/SupplyReserve'))
const MyReservations = lazy(() => import('./pages/supplies/MyReservations'))
const ReservationReview = lazy(() => import('./pages/supplies/ReservationReview'))
const SupplyBorrow = lazy(() => import('./pages/supplies/SupplyBorrow'))
const SupplyReturn = lazy(() => import('./pages/supplies/SupplyReturn'))
const BorrowingManage = lazy(() => import('./pages/supplies/BorrowingManage'))

// Chemicals
const ChemicalLog = lazy(() => import('./pages/chemicals/ChemicalLog'))
const ChemicalHistory = lazy(() => import('./pages/chemicals/ChemicalHistory'))
const ChemicalPurchaseRequest = lazy(() => import('./pages/chemicals/ChemicalPurchaseRequest'))

// Reagents
const ReagentList = lazy(() => import('./pages/reagents/ReagentList'))
const ReagentDetail = lazy(() => import('./pages/reagents/ReagentDetail'))
const ReagentForm = lazy(() => import('./pages/reagents/ReagentForm'))
const ReagentPurchaseRequest = lazy(() => import('./pages/reagents/ReagentPurchaseRequest'))
const ReagentStockMovement = lazy(() => import('./pages/reagents/ReagentStockMovement'))
const MyReagentLedger = lazy(() => import('./pages/reagents/MyReagentLedger'))
const SupplierManage = lazy(() => import('./pages/reagents/SupplierManage'))

// Documents
const DocumentList = lazy(() => import('./pages/documents/DocumentList'))
const DocumentView = lazy(() => import('./pages/documents/DocumentView'))
const DocumentEdit = lazy(() => import('./pages/documents/DocumentEdit'))

// Duty & Equipment
const DutyRoster = lazy(() => import('./pages/duty/DutyRoster'))
const EquipmentList = lazy(() => import('./pages/duty/EquipmentList'))

// Meetings
const MeetingList = lazy(() => import('./pages/meetings/MeetingList'))
const ProgressReport = lazy(() => import('./pages/meetings/ProgressReport'))

// Reimbursements
const ReimbursementList = lazy(() => import('./pages/reimbursements/ReimbursementList'))
const ReimbursementForm = lazy(() => import('./pages/reimbursements/ReimbursementForm'))
const ReimbursementReview = lazy(() => import('./pages/reimbursements/ReimbursementReview'))

// Profile
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'))

// Admin
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AnnouncementManage = lazy(() => import('./pages/admin/AnnouncementManage'))
const MemberManage = lazy(() => import('./pages/admin/MemberManage'))
const SupplyManage = lazy(() => import('./pages/admin/SupplyManage'))
const DataExport = lazy(() => import('./pages/admin/DataExport'))

function PageLoader() {
  return <LoadingSpinner />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected routes with layout */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />

              {/* Supplies */}
              <Route path="/supplies" element={<SupplyList />} />
              <Route path="/supplies/reserve" element={<SupplyReserve />} />
              <Route path="/supplies/my-reservations" element={<MyReservations />} />
              <Route path="/supplies/review" element={<ProtectedRoute requiredModule="supplies"><ReservationReview /></ProtectedRoute>} />
              <Route path="/supplies/borrow" element={<SupplyBorrow />} />
              <Route path="/supplies/my-returns" element={<SupplyReturn />} />
              <Route path="/supplies/borrowings" element={<ProtectedRoute requiredModule="supplies"><BorrowingManage /></ProtectedRoute>} />

              {/* Reagents */}
              <Route path="/reagents" element={<ReagentList />} />
              <Route path="/reagents/new" element={<ProtectedRoute requiredModule="chemicals"><ReagentForm /></ProtectedRoute>} />
              <Route path="/reagents/:id" element={<ReagentDetail />} />
              <Route path="/reagents/:id/edit" element={<ProtectedRoute requiredModule="chemicals"><ReagentForm /></ProtectedRoute>} />
              <Route path="/reagents/purchase" element={<ReagentPurchaseRequest />} />
              <Route path="/reagents/stock" element={<ProtectedRoute requiredModule="chemicals"><ReagentStockMovement /></ProtectedRoute>} />
              <Route path="/reagents/my-ledger" element={<MyReagentLedger />} />
              <Route path="/reagents/suppliers" element={<ProtectedRoute requiredModule="chemicals"><SupplierManage /></ProtectedRoute>} />

              {/* Chemicals legacy */}
              <Route path="/chemicals" element={<ReagentList />} />
              <Route path="/chemicals/log" element={<ChemicalLog />} />
              <Route path="/chemicals/history" element={<ChemicalHistory />} />
              <Route path="/chemicals/purchase" element={<ChemicalPurchaseRequest />} />

              {/* Documents */}
              <Route path="/documents" element={<DocumentList />} />
              <Route path="/documents/:id" element={<DocumentView />} />
              <Route path="/documents/new" element={<ProtectedRoute requiredRole="manager"><DocumentEdit /></ProtectedRoute>} />
              <Route path="/documents/:id/edit" element={<ProtectedRoute requiredRole="manager"><DocumentEdit /></ProtectedRoute>} />

              {/* Duty & Equipment */}
              <Route path="/duty" element={<DutyRoster />} />
              <Route path="/equipment" element={<EquipmentList />} />

              {/* Meetings */}
              <Route path="/meetings" element={<MeetingList />} />
              <Route path="/meetings/report" element={<ProgressReport />} />

              {/* Reimbursements */}
              <Route path="/reimbursements" element={<ReimbursementList />} />
              <Route path="/reimbursements/new" element={<ReimbursementForm />} />
              <Route path="/reimbursements/review" element={<ProtectedRoute requiredRole="admin"><ReimbursementReview /></ProtectedRoute>} />

              {/* Profile */}
              <Route path="/profile" element={<ProfilePage />} />

              {/* Admin */}
              <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/announcements" element={<ProtectedRoute requiredRole="admin"><AnnouncementManage /></ProtectedRoute>} />
              <Route path="/admin/members" element={<ProtectedRoute requiredModule="members"><MemberManage /></ProtectedRoute>} />
              <Route path="/admin/supplies" element={<ProtectedRoute requiredModule="supplies"><SupplyManage /></ProtectedRoute>} />
              <Route path="/admin/export" element={<ProtectedRoute requiredRole="admin"><DataExport /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
