type ColumnFactory<TColumn> = (name: string) => TColumn;

export function createLogEntryColumns<TRequestTs, TText, TDurationMs>(options: {
  requestTs: ColumnFactory<TRequestTs>;
  text: ColumnFactory<TText>;
  durationMs: ColumnFactory<TDurationMs>;
}) {
  return {
    requestTs: options.requestTs("request_ts"),
    clientIp: options.text("client_ip"),
    clientName: options.text("client_name"),
    durationMs: options.durationMs("duration_ms"),
    reason: options.text("reason"),
    responseType: options.text("response_type"),
    questionType: options.text("question_type"),
    questionName: options.text("question_name"),
    effectiveTldp: options.text("effective_tldp"),
    answer: options.text("answer"),
    responseCode: options.text("response_code"),
    hostname: options.text("hostname"),
  };
}
