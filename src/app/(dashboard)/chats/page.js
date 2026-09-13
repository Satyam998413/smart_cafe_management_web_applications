'use client';

import { useDashboard } from '@/features/dashboard/DashboardContext';
import ChatsPage from '@/features/chats/ChatsPage';

export default function ChatsRoute() {
  const { apiFetch, authRole, myId, socket } = useDashboard();

  return <ChatsPage apiFetch={apiFetch} authRole={authRole} myId={myId} socket={socket} />;
}
