'use client';

import { useDashboard } from '@/features/dashboard/DashboardContext';
import TeamChatPage from '@/features/chats/TeamChatPage';

export default function TeamRoute() {
  const { apiFetch, authRole, myId } = useDashboard();

  return <TeamChatPage apiFetch={apiFetch} authRole={authRole} myId={myId} />;
}
