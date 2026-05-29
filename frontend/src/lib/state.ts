import { derived, writable } from "svelte/store";
import type { RestlerConfig } from "./types";

const initialConfig: RestlerConfig = {
  projectName: "BioInformatic",
  dockerTargetName: "bioinformatics-serving-api",
  dockerImage: "restler",
  workspacePath: "E:\\repoE\\BioInformatics\\tmp\\restler",
  specPath: "E:\\repoE\\BioInformatics\\tmp\\restler\\openapi.json",
  openApiUrl: "http://localhost:8001/openapi.json",
  containerWorkdir: "/work",
  host: "host.docker.internal",
  targetIp: "host.docker.internal",
  targetPort: 8001,
  useSsl: false,
  payloadPath: "E:\\repoE\\BioInformatics\\tmp\\restler\\payload.json",
  payloadBody: '{\n  "notes": "Paste sample payloads or request templates here."\n}',
  grammarPath: "/work/Compile/grammar.py",
  dictionaryPath: "/work/Compile/dict.json",
  settingsPath: "/work/Compile/engine_settings.json",
  resultsRootPath: "E:\\repoE\\BioInformatics\\tmp\\restler",
  resultsSummaryPath: "E:\\repoE\\BioInformatics\\tmp\\restler\\Test\\RestlerResults\\experiment30\\logs\\testing_summary.json",
  resultsLogPath: "E:\\repoE\\BioInformatics\\tmp\\restler\\Test\\coverage_failures_to_investigate.txt",
  authCommand: "python /tools/utilities/get_bio_token.py",
  timeBudget: 1,
};

export const restlerConfig = writable<RestlerConfig>(initialConfig);

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function formatHoursFromMinutes(minutes: number) {
  const hours = minutes / 60;
  return hours.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export const selectedModeMeta = derived(restlerConfig, () => ({
  label: "Fuzz Full",
  desc: "Compile the spec and then run full BFS-fast fuzzing.",
}));

export const specInContainer = derived(restlerConfig, ($restlerConfig) =>
  $restlerConfig.specPath
    .replace($restlerConfig.workspacePath, $restlerConfig.containerWorkdir)
    .replace(/\\/g, "/"),
);

export const dictionaryHostPath = derived(restlerConfig, ($restlerConfig) =>
  $restlerConfig.dictionaryPath.startsWith($restlerConfig.containerWorkdir)
    ? `${$restlerConfig.workspacePath}\\${$restlerConfig.dictionaryPath
        .slice($restlerConfig.containerWorkdir.length)
        .replace(/^\/+/, "")
        .replace(/\//g, "\\")}`
    : $restlerConfig.dictionaryPath,
);

export const payloadInContainer = derived(restlerConfig, ($restlerConfig) =>
  $restlerConfig.payloadPath
    ? $restlerConfig.payloadPath
        .replace($restlerConfig.workspacePath, $restlerConfig.containerWorkdir)
        .replace(/\\/g, "/")
    : "",
);

export const expectedOutput = derived(restlerConfig, () =>
  "Compile/* plus Fuzz/RestlerResults/.../bug_buckets and logs",
);

export const expectedResultFiles = derived(restlerConfig, () => [
  "Compile/grammar.py",
  "Compile/dict.json",
  "Compile/engine_settings.json",
  "Fuzz/RestlerResults/.../bug_buckets/bug_buckets.txt",
  "Fuzz/RestlerResults/.../logs/network.testing.*.txt",
  "Fuzz/RestlerResults/.../logs/main.txt",
]);

export const actionCommand = derived(
  [restlerConfig, specInContainer],
  ([$restlerConfig, $specInContainer]) => {
    const fetchSpecCommand = [
      "Invoke-WebRequest",
      `-Uri ${shellQuote($restlerConfig.openApiUrl)}`,
      `-OutFile ${shellQuote($restlerConfig.specPath)}`,
    ].join(" ");

    const baseDockerParts = [
      "docker run --rm",
      `-v ${shellQuote(`${$restlerConfig.workspacePath}:${$restlerConfig.containerWorkdir}`)}`,
      `-v ${shellQuote("E:\\repoE\\restler-fuzzer:/tools")}`,
      `-w ${$restlerConfig.containerWorkdir}`,
      "-e BIO_API_BASE_URL=http://host.docker.internal:8001",
      "-e BIO_USERNAME=admin",
      "-e BIO_PASSWORD=admin123",
      $restlerConfig.dockerImage,
      "/RESTler/restler/Restler",
    ];

    const compileCommand = [
      baseDockerParts.join(" "),
      "compile",
      `--api_spec ${shellQuote($specInContainer)}`,
    ].join(" ");

    const fuzzCommand = [
      `${baseDockerParts.join(" ")} fuzz`,
      `--grammar_file ${$restlerConfig.grammarPath}`,
      `--dictionary_file ${$restlerConfig.dictionaryPath}`,
      `--settings ${$restlerConfig.settingsPath}`,
      `--host ${$restlerConfig.host}`,
      `--target_ip ${$restlerConfig.targetIp}`,
      `--target_port ${$restlerConfig.targetPort}`,
      "--search_strategy bfs-fast",
      $restlerConfig.useSsl ? "" : "--no_ssl",
      $restlerConfig.authCommand
        ? `--token_refresh_interval 300 --token_refresh_command ${shellQuote($restlerConfig.authCommand)}`
        : "",
      `--time_budget ${formatHoursFromMinutes($restlerConfig.timeBudget)}`,
    ]
      .filter(Boolean)
      .join(" ");

    return [
      "# 1. Fetch openapi.json from the running API",
      fetchSpecCommand,
      "",
      "# 2. Compile the OpenAPI spec into RESTler grammar",
      compileCommand,
      "",
      "# 3. Run full fuzzing with BFS-fast",
      fuzzCommand,
    ].join("\n");
  },
);

export const commandSteps = derived(
  [restlerConfig, specInContainer],
  ([$restlerConfig, $specInContainer]) => {
    const fetchSpecCommand = [
      "Invoke-WebRequest",
      `-Uri ${shellQuote($restlerConfig.openApiUrl)}`,
      `-OutFile ${shellQuote($restlerConfig.specPath)}`,
    ].join(" ");

    const baseDockerParts = [
      "docker run --rm",
      `-v ${shellQuote(`${$restlerConfig.workspacePath}:${$restlerConfig.containerWorkdir}`)}`,
      `-v ${shellQuote("E:\\repoE\\restler-fuzzer:/tools")}`,
      `-w ${$restlerConfig.containerWorkdir}`,
      "-e BIO_API_BASE_URL=http://host.docker.internal:8001",
      "-e BIO_USERNAME=admin",
      "-e BIO_PASSWORD=admin123",
      $restlerConfig.dockerImage,
      "/RESTler/restler/Restler",
    ];

    const compileCommand = [
      baseDockerParts.join(" "),
      "compile",
      `--api_spec ${shellQuote($specInContainer)}`,
    ].join(" ");

    const fuzzCommand = [
      `${baseDockerParts.join(" ")} fuzz`,
      `--grammar_file ${$restlerConfig.grammarPath}`,
      `--dictionary_file ${$restlerConfig.dictionaryPath}`,
      `--settings ${$restlerConfig.settingsPath}`,
      `--host ${$restlerConfig.host}`,
      `--target_ip ${$restlerConfig.targetIp}`,
      `--target_port ${$restlerConfig.targetPort}`,
      "--search_strategy bfs-fast",
      $restlerConfig.useSsl ? "" : "--no_ssl",
      $restlerConfig.authCommand
        ? `--token_refresh_interval 300 --token_refresh_command ${shellQuote($restlerConfig.authCommand)}`
        : "",
      `--time_budget ${formatHoursFromMinutes($restlerConfig.timeBudget)}`,
    ]
      .filter(Boolean)
      .join(" ");

    return [
      {
        id: "fetch",
        title: "Fetch openapi.json",
        description: "Download the live OpenAPI document into the Bio workspace.",
        command: fetchSpecCommand,
      },
      {
        id: "compile",
        title: "Compile RESTler grammar",
        description: "Generate grammar, dictionary, and engine settings from the spec.",
        command: compileCommand,
      },
      {
        id: "fuzz",
        title: "Run full fuzzing",
        description: "Start full BFS-fast fuzzing with the current workspace settings.",
        command: fuzzCommand,
      },
    ];
  },
);

export function updateConfigField<K extends keyof RestlerConfig>(
  field: K,
  value: RestlerConfig[K],
) {
  restlerConfig.update((config) => ({ ...config, [field]: value }));
}
