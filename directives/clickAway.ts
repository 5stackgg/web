export default {
  mounted(el, binding) {
    const callback = binding.value;
    el["click_away"] = (event) => {
      if (
        !el.contains(event.target) &&
        callback &&
        typeof callback === "function"
      ) {
        if (document.body.contains(event.target)) {
          return callback();
        }
      }
    };
    setTimeout(() => {
      document.addEventListener("click", el["click_away"], false);
    }, 0);
  },
  beforeUnmount(el) {
    document.removeEventListener("click", el["click_away"], false);
    delete el["click_away"];
  },
};
