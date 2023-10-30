<template>
  <div class="tabs-container">
    <div
      class="tabs"
      :class="{ 'tabs-square': square, 'tabs-vertical': vertical }"
    >
      <template
        v-for="(tab, index) in tabs"
        :key="`${index}-${new Date().toISOString()}`"
      >
        <tab-title
          :tab="tab"
          v-bind="{ ...tab.props }"
          :class="{ selected: index === activeTab }"
          @click="selectedTab = index"
        />
      </template>
    </div>
    <template v-for="(tab, index) in tabs" :key="index">
      <tabbed-v-node-content v-if="index === activeTab" :vnode="tab" />
    </template>
  </div>
</template>

<script>
import TabTitle from "./TabTitle.vue";
import TabbedVNodeContent from "./TabbedVNodeContent.vue";
export default {
  components: {
    TabTitle,
    TabbedVNodeContent,
  },
  props: {
    square: {
      default: false,
      type: Boolean,
    },
    vertical: {
      default: false,
      type: Boolean,
    },
    active: {
      type: Number,
      required: false,
      default: 0,
    },
  },
  data() {
    return {
      selectedTab: 0,
    };
  },
  computed: {
    tabs() {
      return this.getTabs(this.$slots.default());
    },
    activeTab() {
      const numberOfTabs = this.tabs.length - 1;
      return this.selectedTab <= numberOfTabs ? this.selectedTab : numberOfTabs;
    },
  },
  watch: {
    active: {
      immediate: true,
      handler(active) {
        this.selectedTab = active;
      },
    },
  },
  methods: {
    getTabs(_tabs) {
      let tabs = [];
      for (const tab of _tabs) {
        if (typeof tab.type === "symbol") {
          if (Array.isArray(tab.children)) {
            tabs.push(...this.getTabs(tab.children));
          }
          continue;
        }
        if (!tab.props) {
          console.info(
            "failed to render a tab, must be an error in the component",
          );
          continue;
        }
        tabs.push(tab);
      }

      return tabs;
    },
  },
};
</script>
