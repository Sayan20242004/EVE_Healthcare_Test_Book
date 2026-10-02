export function filterCentresByTest(centres, query) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return centres;
  return centres.filter((centre) =>
    (centre.tests || []).some((test) => String(test.name || '').toLocaleLowerCase().includes(needle))
  );
}
