import HistoryItemList from "happy-dom/lib/history/HistoryItemList.js";

// happy-dom drops everything ahead of the current entry on replaceState. A
// browser does not: only a push does. Tests that replace an entry and then
// go Forward need the browser's behaviour.
export function keepForwardEntriesOnReplace() {
  const list = HistoryItemList.prototype as unknown as {
    items: unknown[];
    currentItem: unknown;
    replace: (item: unknown) => void;
  };
  list.replace = function (item: unknown) {
    const index = this.items.indexOf(this.currentItem);
    if (index === -1) {
      throw new Error("Current history item not found");
    }
    this.currentItem = item;
    this.items[index] = item;
  };
}
