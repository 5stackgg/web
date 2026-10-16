import { defineAsyncComponent, type AsyncComponentLoader } from "vue";
import LazyPanelLoading from "~/components/common/LazyPanelLoading.vue";

// A tab or lens whose code loads on first open. Without a placeholder it
// renders nothing until the chunk lands, so the panel collapses (and any
// HeightGlide around it dips toward zero) before its own skeleton appears.
export function lazyPanel(loader: AsyncComponentLoader) {
  return defineAsyncComponent({
    loader,
    loadingComponent: LazyPanelLoading,
    delay: 0,
  });
}
