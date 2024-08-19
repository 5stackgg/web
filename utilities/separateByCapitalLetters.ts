export function separateByCapitalLetters(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1 $2");
}
