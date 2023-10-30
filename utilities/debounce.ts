export default function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return function (...args: Parameters<T>): void {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      // @ts-ignore
      func.apply(this, args);
    }, delay);
  };
}
