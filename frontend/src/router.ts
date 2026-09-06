import { createRouter, createWebHistory } from 'vue-router'
import LoginView from './views/LoginView.vue'
import AppShellView from './views/AppShellView.vue'
import EventsView from './views/EventsView.vue'
import EventDetailView from './views/EventDetailView.vue'
import PeopleView from './views/PeopleView.vue'
import PersonDetailView from './views/PersonDetailView.vue'
import SimulatorView from './views/SimulatorView.vue'
import DashboardView from './views/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    {
      path: '/',
      component: AppShellView,
      children: [
        { path: '', redirect: '/events' },
        { path: 'events', name: 'events', component: EventsView },
        { path: 'events/:id', name: 'event-detail', component: EventDetailView },
        { path: 'people', name: 'people', component: PeopleView },
        { path: 'people/:id', name: 'person-detail', component: PersonDetailView },
        { path: 'simulator', name: 'simulator', component: SimulatorView },
        { path: 'dashboard', name: 'dashboard', component: DashboardView },
      ],
    },
  ],
})

export default router
