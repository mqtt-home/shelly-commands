export interface ActorStatus {
  name: string;
  displayName: string;
  ip: string;
  serial: string;
  position: number;
  tilted: boolean;
  tiltPosition: number;
  deviceType: string;
  rank: number;
  groupId?: string; // Make groupId optional since it might not exist
}

export interface GroupInfo {
  groupId: string;
  name: string;
  actorCount: number;
  actors: ActorStatus[];
}
