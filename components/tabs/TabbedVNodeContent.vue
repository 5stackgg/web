<script>
export default {
  props: {
    vnode: {
      required: true,
      type: Object,
    },
  },
  render() {
    return this.vnode;
  },
};
</script>
