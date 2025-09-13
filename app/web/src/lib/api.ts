import { ActorStatus, GroupInfo } from '@/types/actor';

export const API_BASE = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

export async function fetchActors(): Promise<ActorStatus[]> {
  const response = await fetch(`${API_BASE}/actors`);
  if (!response.ok) {
    throw new Error('Failed to fetch actors');
  }
  return response.json();
}

export async function fetchActor(name: string): Promise<ActorStatus> {
  const response = await fetch(`${API_BASE}/actors/${encodeURIComponent(name)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch actor ${name}`);
  }
  return response.json();
}

export async function setActorPosition(name: string, position: number): Promise<void> {
  const response = await fetch(`${API_BASE}/actors/${encodeURIComponent(name)}/position`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ position }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set position for actor ${name}`);
  }
}

export async function tiltActor(name: string, position: number): Promise<void> {
  const response = await fetch(`${API_BASE}/actors/${encodeURIComponent(name)}/tilt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ position }),
  });
  if (!response.ok) {
    throw new Error(`Failed to tilt actor ${name}`);
  }
}

export async function tiltAllActors(position: number): Promise<void> {
  const response = await fetch(`${API_BASE}/actors/all/tilt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ position }),
  });
  if (!response.ok) {
    throw new Error('Failed to tilt all actors');
  }
}

export async function setSlatPosition(name: string, position: number): Promise<void> {
  const response = await fetch(`${API_BASE}/actors/${encodeURIComponent(name)}/slat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ position }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set slat position for actor ${name}`);
  }
}

export async function setSlatPositionAll(position: number): Promise<void> {
  const response = await fetch(`${API_BASE}/actors/all/slat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ position }),
  });
  if (!response.ok) {
    throw new Error('Failed to set slat position for all actors');
  }
}

export async function setAllActorsPosition(position: number): Promise<void> {
  const response = await fetch(`${API_BASE}/actors/all/position`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ position }),
  });
  if (!response.ok) {
    throw new Error('Failed to set position for all actors');
  }
}

// Group API functions
export async function fetchGroups(): Promise<GroupInfo[]> {
  const response = await fetch(`${API_BASE}/groups`);
  if (!response.ok) {
    throw new Error('Failed to fetch groups');
  }
  return response.json();
}

export async function setGroupPosition(groupId: string, position: number): Promise<void> {
  const response = await fetch(`${API_BASE}/groups/${encodeURIComponent(groupId)}/position`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ position }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set position for group ${groupId}`);
  }
}

export async function tiltGroup(groupId: string, position: number): Promise<void> {
  const response = await fetch(`${API_BASE}/groups/${encodeURIComponent(groupId)}/tilt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ position }),
  });
  if (!response.ok) {
    throw new Error(`Failed to tilt group ${groupId}`);
  }
}

export async function setSlatPositionGroup(groupId: string, position: number): Promise<void> {
  const response = await fetch(`${API_BASE}/groups/${encodeURIComponent(groupId)}/slat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ position }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set slat position for group ${groupId}`);
  }
}
