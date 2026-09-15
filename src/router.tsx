import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@/layouts/AppLayout'
import DashboardView from '@/views/DashboardView'
import CreateProjectView from './views/projects/CreateProjectView'
import EditProjectView from './views/projects/EditProjectView'
import ProjectDetailsView from './views/projects/ProjectDetailsView'
import AuthLayout from './layouts/AuthLayout'
import LoginView from './views/auth/LoginView'
import RegisterView from './views/auth/RegisterView'
import ConfirmAccountView from './views/auth/ConfirmAccountView'
import RequestNewCodeView from './views/auth/RequestNewCodeView'
import ForgotPasswordView from './views/auth/ForgotPasswordView'
import NewPasswordView from './views/auth/NewPasswordView'
import ProjectTeamView from './views/projects/ProjectTeamView'
import ProfileView from './views/profile/ProfileView'
import ChangePasswordView from './views/profile/ChangePasswordView'
import ProfileLayout from './layouts/ProfileLayout'
import NotFound from './views/404/NotFound'
import MyWorkView from './views/MyWorkView'
import MaintenanceView from './views/MaintenanceView'
import MyWeekView from './views/schedule/MyWeekView'
import TeamBoardView from './views/TeamBoardView'
import MemosView from './views/MemosView'

export default function Router() {

    return (
        <BrowserRouter>
            <Routes>
                <Route element={<AppLayout />}>
                    <Route path='/' element={<MyWorkView />} index />
                    <Route path='/semana' element={<MyWeekView />} />
                    <Route path='/mantenimiento' element={<MaintenanceView />} />
                    <Route path='/notas' element={<MemosView />} />
                    <Route path='/equipo' element={<TeamBoardView />} />
                    <Route path='/proyectos' element={<DashboardView />} />
                    <Route path='/projects/create' element={<CreateProjectView />} />
                    <Route path='/projects/:projectId' element={<ProjectDetailsView />} />
                    <Route path='/projects/:projectId/edit' element={<EditProjectView />} />
                    <Route path='/projects/:projectId/team' element={<ProjectTeamView />} />
                    <Route element={<ProfileLayout />}>
                        <Route path='/profile' element={<ProfileView />} />
                        <Route path='/profile/password' element={<ChangePasswordView />} />
                    </Route>

                    {/* "Mi día" se fusionó con "Mi trabajo" */}
                    <Route path='/mi-dia' element={<Navigate to='/' replace />} />
                </Route>

                <Route element={<AuthLayout />}>
                    <Route path='/auth/login' element={<LoginView />} />
                    <Route path='/auth/register' element={<RegisterView />} />
                    <Route path='/auth/confirm-account' element={<ConfirmAccountView />} />
                    <Route path='/auth/request-code' element={<RequestNewCodeView />} />
                    <Route path='/auth/forgot-password' element={<ForgotPasswordView />} />
                    <Route path='/auth/new-password' element={<NewPasswordView />} />
                </Route>

                <Route element={<AuthLayout />}>
                    <Route path='*' element={<NotFound />}  />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}
