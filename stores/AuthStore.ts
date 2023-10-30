import { ref } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { generateQuery } from "~/graphql/graphqlGen";
import { meFields } from "~/graphql/meGraphql";
import getGraphqlClient from "~/graphql/getGraphqlClient";

export const useAuthStore = defineStore("auth", () => {
  const me = ref<typeof meFields>();

  async function getMe() {
    const response = await getGraphqlClient().query({
      query: generateQuery({
        me: meFields,
      }),
    });
    me.value = response.data.me;
  }

  void getMe();

  return {
    me,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot));
}
