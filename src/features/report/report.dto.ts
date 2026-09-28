export interface AspirantSummaryDto {
  total: number;
  active: number;
  inactive: number;
}

export interface AdminSummaryDto {
  total: number;
  systemAdmins: number;
  superAdmins: number;
}

export interface SystemActorsSummaryDto {
  totalStates: number;
  totalLgas: number;
  totalWards: number;
  totalPollingUnits: number;
  aspirants: AspirantSummaryDto;
  totalLgaCoordinators: number;
  totalWardCoordinators: number;
  totalPollingUnitAgents: number;
  totalPoliticalParties: number;
  totalElectoralOffices: number;
  admins: AdminSummaryDto;
}
