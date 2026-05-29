export type RestlerConfig = {
  projectName: string;
  dockerTargetName: string;
  dockerImage: string;
  workspacePath: string;
  specPath: string;
  openApiUrl: string;
  containerWorkdir: string;
  host: string;
  targetIp: string;
  targetPort: number;
  useSsl: boolean;
  payloadPath: string;
  payloadBody: string;
  grammarPath: string;
  dictionaryPath: string;
  settingsPath: string;
  resultsRootPath: string;
  resultsSummaryPath: string;
  resultsLogPath: string;
  authCommand: string;
  timeBudget: number;
};

export type AppRoute = {
  path: string;
  label: string;
  description: string;
};

export type SbflFormulaId = string;

export type SbflFormula = {
  id: SbflFormulaId;
  label: string;
  description: string;
  formulaText: string;
};

export type RankedRiskRequest = {
  endpoint: string;
  aef: number;
  aep: number;
  anf: number;
  anp: number;
  note: string;
  score: number;
};

export type AvailableRequest = {
  method: string;
  path: string;
  auth: boolean;
};

export type MethodCount = {
  method: string;
  count: number;
};

export type StatusCount = {
  code: string;
  count: number;
};

export type BugBucketSummary = {
  checker: string;
  errorCode: string;
  count: number;
  reproducible: boolean;
};

export type NotableFailure = {
  endpoint: string;
  statusCode: string;
  reason: string;
};

export type FailingSequence = {
  title: string;
  outcome: string;
  requests: string[];
  reason: string;
  aiSuspicionScore?: number | null;
  aiSuspicionReason?: string;
  aiSuspicionSource?: "cache" | "fresh";
};

export type ResultsAnalysisSnapshot = {
  generatedFrom: string;
  reportName?: string;
  availableRequests: AvailableRequest[];
  testSummary: {
    finalSpecCoverage: string;
    renderedRequests: string;
    validSequences: string;
    totalRequestsSent: number;
    reproducibleBugBuckets: Record<string, number>;
  };
  requestMethodCounts: MethodCount[];
  requestValidityCounts: { label: string; count: number }[];
  responseStatusCounts: StatusCount[];
  bugBuckets: BugBucketSummary[];
  notableFailures: NotableFailure[];
  failingSequences: FailingSequence[];
};

export type SequenceAiAnalysis = {
  model: string;
  summary: string;
  failure_stage: string;
  likely_causes: string[];
  suggested_fixes: string[];
  verification_steps: string[];
  suspicious_requests: string[];
};

export type RestlerRunSummary = {
  id: string;
  kind: string;
  experimentName: string;
  reportName: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  requestCoverage: string;
  renderedRequests: string;
  validSequences: string;
  totalRequestsSent: number;
  bugBucketCount: number;
  bugBuckets: { name: string; count: number }[];
};
