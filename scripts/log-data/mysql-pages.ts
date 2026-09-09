export async function* mysqlPages<Row extends { id: number }>(
  readPage: (afterId: number, limit: number) => Promise<Row[]>,
  maximum = Infinity,
) {
  let afterId = 0;
  let remaining = maximum;

  while (remaining > 0) {
    const rows = await readPage(afterId, Math.min(1000, remaining));

    if (rows.length === 0) {
      return;
    }

    for (const row of rows) {
      yield row;
      afterId = row.id;
      remaining--;
    }
  }
}
