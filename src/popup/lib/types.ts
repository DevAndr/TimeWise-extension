export interface SiteTime {
  domain: string;
  time: number;
}

export interface ActiveSession {
  tabId: number;
  startTime: number;
  url: string;
}
