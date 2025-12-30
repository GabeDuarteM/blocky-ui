export function generateMockPrometheusMetrics(): string {
  const totalQueries = 12453;
  const blockedQueries = 2134;
  const cachedQueries = 8976;
  const resolvedQueries = Math.max(
    0,
    totalQueries - blockedQueries - cachedQueries,
  );

  const cacheHits = 9832;
  const cacheMisses = 2621;
  const cacheEntries = 4521;

  const denylistGroups = [
    { name: "default", count: 86832 },
    { name: "ads", count: 42156 },
    { name: "malware", count: 12543 },
  ];

  const allowlistGroups = [
    { name: "default", count: 156 },
    { name: "ads", count: 89 },
  ];

  const lines: string[] = [];

  lines.push("# HELP blocky_build_info Version number and build info");
  lines.push("# TYPE blocky_build_info gauge");
  lines.push(
    'blocky_build_info{version="v0.24",build_time="2024-01-15T10:30:00Z"} 1',
  );

  lines.push("# HELP blocky_blocking_enabled Blocking status");
  lines.push("# TYPE blocky_blocking_enabled gauge");
  lines.push("blocky_blocking_enabled 1");

  lines.push("# HELP blocky_query_total Number of total queries");
  lines.push("# TYPE blocky_query_total counter");
  lines.push(
    `blocky_query_total{client="192.168.1.100",type="A"} ${Math.floor(totalQueries * 0.6)}`,
  );
  lines.push(
    `blocky_query_total{client="192.168.1.101",type="A"} ${Math.floor(totalQueries * 0.25)}`,
  );
  lines.push(
    `blocky_query_total{client="192.168.1.102",type="AAAA"} ${Math.floor(totalQueries * 0.15)}`,
  );

  lines.push("# HELP blocky_response_total Number of total responses");
  lines.push("# TYPE blocky_response_total counter");
  lines.push(
    `blocky_response_total{reason="BLOCKED",response_code="NOERROR",response_type="BLOCKED"} ${blockedQueries}`,
  );
  lines.push(
    `blocky_response_total{reason="CACHED",response_code="NOERROR",response_type="CACHED"} ${cachedQueries}`,
  );
  lines.push(
    `blocky_response_total{reason="RESOLVED",response_code="NOERROR",response_type="RESOLVED"} ${resolvedQueries}`,
  );

  lines.push("# HELP blocky_error_total Number of total errors");
  lines.push("# TYPE blocky_error_total counter");
  lines.push("blocky_error_total 42");

  lines.push("# HELP blocky_cache_entries Number of entries in result cache");
  lines.push("# TYPE blocky_cache_entries gauge");
  lines.push(`blocky_cache_entries ${cacheEntries}`);

  lines.push("# HELP blocky_cache_hits_total Cache hit counter");
  lines.push("# TYPE blocky_cache_hits_total counter");
  lines.push(`blocky_cache_hits_total ${cacheHits}`);

  lines.push("# HELP blocky_cache_misses_total Cache miss counter");
  lines.push("# TYPE blocky_cache_misses_total counter");
  lines.push(`blocky_cache_misses_total ${cacheMisses}`);

  lines.push(
    "# HELP blocky_denylist_cache_entries Number of entries in denylist cache",
  );
  lines.push("# TYPE blocky_denylist_cache_entries gauge");
  for (const group of denylistGroups) {
    lines.push(
      `blocky_denylist_cache_entries{group="${group.name}"} ${group.count}`,
    );
  }

  lines.push(
    "# HELP blocky_allowlist_cache_entries Number of entries in allowlist cache",
  );
  lines.push("# TYPE blocky_allowlist_cache_entries gauge");
  for (const group of allowlistGroups) {
    lines.push(
      `blocky_allowlist_cache_entries{group="${group.name}"} ${group.count}`,
    );
  }

  lines.push(
    "# HELP blocky_request_duration_seconds Request duration distribution",
  );
  lines.push("# TYPE blocky_request_duration_seconds histogram");
  lines.push(
    'blocky_request_duration_seconds_bucket{response_type="RESOLVED",le="0.005"} 1200',
  );
  lines.push(
    'blocky_request_duration_seconds_bucket{response_type="RESOLVED",le="0.01"} 2400',
  );
  lines.push(
    'blocky_request_duration_seconds_bucket{response_type="RESOLVED",le="0.05"} 3800',
  );
  lines.push(
    'blocky_request_duration_seconds_bucket{response_type="RESOLVED",le="+Inf"} 4200',
  );
  lines.push(
    'blocky_request_duration_seconds_sum{response_type="RESOLVED"} 126.5',
  );
  lines.push(
    'blocky_request_duration_seconds_count{response_type="RESOLVED"} 4200',
  );

  return lines.join("\n");
}
