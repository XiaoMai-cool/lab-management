import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { ModeProvider } from './contexts/ModeContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import LoadingSpinner from './components/LoadingSpinner'

const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const ModeSelect = lazy(() => import('./pages/ModeSelect'))
const Dashboard = lazy(() => import('./pages/Dashboard'))

// Supplies
const SupplyList = lazy(() => import('./pages/supplies/SupplyList'))
const SupplyReserve = lazy(() => import('./pages/supplies/SupplyReserve'))
const MyReservations = lazy(() => import('./pages/supplies/MyReservations'))
const ReservationReview = lazy(() => import('./pages/supplies/ReservationReview'))
const SupplyReturn = lazy(() => import('./pages/supplies/SupplyReturn'))
const BorrowingManage = lazy(() => import('./pages/supplies/BorrowingManage'))

// Reagents
const ReagentList = lazy(() => import('./pages/reagents/ReagentList'))
const ReagentDetail = lazy(() => import('./pages/reagents/ReagentDetail'))
const ReagentForm = lazy(() => import('./pages/reagents/ReagentForm'))
const ReagentPurchaseRequest = lazy(() => import('./pages/reagents/ReagentPurchaseRequest'))

const ChemicalWarnings = lazy(() => import('./pages/reagents/ChemicalWarnings'))

// Documents
const DocumentList = lazy(() => import('./pages/documents/DocumentList'))
const DocumentView = lazy(() => import('./pages/documents/DocumentView'))
const DocumentEdit = lazy(() => import('./pages/documents/DocumentEdit'))
const AnnouncementView = lazy(() => import('./pages/documents/AnnouncementView'))

// Duty
const DutyRoster = lazy(() => import('./pages/duty/DutyRoster'))
const DutyManage = lazy(() => import('./pages/admin/DutyManage'))

// Reimbursements
const ReimbursementForm = lazy(() => import('./pages/reimbursements/ReimbursementForm'))
const ReimbursementReview = lazy(() => import('./pages/reimbursements/ReimbursementReview'))
const ReimbursementStats = lazy(() => import('./pages/reimbursements/ReimbursementStats'))
const PurchaseApprovalForm = lazy(() => import('./pages/purchase-approvals/PurchaseApprovalForm'))
const PurchaseApprovalReview = lazy(() => import('./pages/purchase-approvals/PurchaseApprovalReview'))
const PurchaseApprovalList = lazy(() => import('./pages/purchase-approvals/PurchaseApprovalList'))

// Purchases
const RegistrationPage = lazy(() => import('./pages/purchases/RegistrationPage'))

// Profile
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'))

// Admin
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AnnouncementManage = lazy(() => import('./pages/admin/AnnouncementManage'))
const MemberManage = lazy(() => import('./pages/admin/MemberManage'))
const SupplyManage = lazy(() => import('./pages/admin/SupplyManage'))
const DataExport = lazy(() => import('./pages/admin/DataExport'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ModeProvider>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/mode-select" element={<ProtectedRoute><ModeSelect /></ProtectedRoute>} />

            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />

              {/* 物资/耗材 */}
              <Route path="/supplies" element={<SupplyList />} />
              <Route path="/supplies/reserve" element={<SupplyReserve />} />
              <Route path="/supplies/my-reservations" element={<MyReservations />} />
              <Route path="/supplies/review" element={<ProtectedRoute requiredModule="supplies"><ReservationReview /></ProtectedRoute>} />
              <Route path="/supplies/my-returns" element={<SupplyReturn />} />
              <Route path="/supplies/borrowings" element={<ProtectedRoute requiredModule="supplies"><BorrowingManage /></ProtectedRoute>} />

              {/* 药品 */}
              <Route path="/reagents" element={<ReagentList />} />
              <Route path="/reagents/new" element={<ProtectedRoute requiredModule="chemicals"><ReagentForm /></ProtectedRoute>} />
              <Route path="/reagents/:id" element={<ReagentDetail />} />
              <Route path="/reagents/:id/edit" element={<ProtectedRoute requiredModule="chemicals"><ReagentForm /></ProtectedRoute>} />
              <Route path="/reagents/purchase" element={<ReagentPurchaseRequest />} />
              <Route path="/reagents/warnings" element={<ProtectedRoute requiredModule="chemicals"><ChemicalWarnings /></ProtectedRoute>} />

              {/* 文档资料 + 公告 */}
              <Route path="/documents" element={<DocumentList />} />
              <Route path="/documents/:id" element={<DocumentView />} />
              <Route path="/documents/new" element={<ProtectedRoute requiredRole="admin"><DocumentEdit /></ProtectedRoute>} />
              <Route path="/documents/:id/edit" element={<ProtectedRoute requiredRole="admin"><DocumentEdit /></ProtectedRoute>} />
              <Route path="/announcements/:id" element={<AnnouncementView />} />

              {/* 值日 */}
              <Route path="/duty" element={<DutyRoster />} />

              {/* 采购审批 + 报销 */}
              <Route path="/purchase-approvals/new" element={<PurchaseApprovalForm />} />
              <Route path="/purchase-approvals/edit/:id" element={<PurchaseApprovalForm />} />
              <Route path="/purchase-approvals" element={<PurchaseApprovalList />} />
              <Route path="/purchase-approvals/review" element={<ProtectedRoute requiredRole="teacher"><PurchaseApprovalReview /></ProtectedRoute>} />
              <Route path="/reimbursements" element={<Navigate to="/purchase-approvals" replace />} />
              <Route path="/reimbursements/new" element={<ReimbursementForm />} />
              <Route path="/reimbursements/review" element={<ProtectedRoute requiredRole="admin"><ReimbursementReview /></ProtectedRoute>} />
              <Route path="/reimbursements/stats" element={<ReimbursementStats />} />

              {/* 入库登记 */}
              <Route path="/purchases/registration" element={<RegistrationPage />} />

              {/* 个人中心 */}
              <Route path="/profile" element={<ProfilePage />} />

              {/* 管理后台 */}
              <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/announcements" element={<ProtectedRoute requiredRole="admin"><AnnouncementManage /></ProtectedRoute>} />
              <Route path="/admin/members" element={<ProtectedRoute requiredModule="members"><MemberManage /></ProtectedRoute>} />
              <Route path="/admin/supplies" element={<ProtectedRoute requiredModule="supplies"><SupplyManage /></ProtectedRoute>} />
              <Route path="/admin/export" element={<ProtectedRoute requiredRole="admin"><DataExport /></ProtectedRoute>} />
<Route path="/admin/duty-manage" element={<ProtectedRoute requiredModule="duty"><DutyManage /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
        </ModeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
