<template>
  <div class="alerts">
    <transition-group name="alert-animation">
      <alert v-for="alert in alerts" :key="alert.id" :alert="alert"></alert>
    </transition-group>
  </div>
</template>

<script>
import alert from "./Alert.vue";
import alertStore from "@/stores/alertStore";

export default {
  components: {
    alert,
  },
  computed: {
    alerts() {
      return alertStore().alerts;
    },
  },
};
</script>

<style lang="scss">
.alerts {
  position: fixed;
  right: 10px;
  top: 66px;
  width: 350px;
  z-index: 1000;
}

.alert {
  @apply text-white;

  border-radius: 3px;
  box-shadow: -1px 1px 4px rgba(0, 0, 0, 0.3);
  margin-bottom: 10px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  position: relative;

  &.error {
    @apply bg-red-500;
  }

  &.success {
    @apply bg-green-500;
  }

  &.info {
    @apply bg-gray-500;
  }

  &.warning {
    @apply bg-orange-500;
  }

  &-heading {
    font-size: 18px;
    margin: 0 0 4px;
    font-weight: 400;
  }

  &-text {
    font-size: 14px;
  }

  &-close {
    cursor: pointer;
    position: absolute;
    top: 5px;
    right: 5px;
    background: none;
    border: none;
    font-size: 26px;
    line-height: 26px;
    @apply text-black;

    &:hover {
      @apply text-black;
    }

    &:focus {
      outline: none;
    }
  }
}

.alert-animation-enter-active {
  transition: all 0.3s ease;
}
.alert-animation-leave-active {
  transition: all 0.2s cubic-bezier(1, 0.5, 0.8, 1);
}
.alert-animation-enter,
.alert-animation-leave-to {
  transform: translateX(10px);
  opacity: 0;
}
</style>
