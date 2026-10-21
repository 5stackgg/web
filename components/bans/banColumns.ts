// The ledger's columns, shared by the header and every row. Phones stack the
// row instead (see BanRow). Last match here joins from xl; With you only
// exists for a signed-in viewer.
export function banColumns(signedIn: boolean): string {
  return signedIn
    ? "md:grid-cols-[minmax(0,1.35fr)_minmax(0,1.15fr)_7rem_7.5rem_9.5rem] xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1.15fr)_7rem_7.5rem_8.5rem_9.5rem]"
    : "md:grid-cols-[minmax(0,1.35fr)_minmax(0,1.15fr)_7rem_7.5rem] xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1.15fr)_7rem_7.5rem_8.5rem]";
}
