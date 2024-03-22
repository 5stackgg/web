import { ref } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { generateQuery } from "~/graphql/graphqlGen";
import { meFields } from "~/graphql/meGraphql";
import getGraphqlClient from "~/graphql/getGraphqlClient";

export const useAuthStore = defineStore("auth", () => {
  const me = ref<typeof meFields>();

  async function getMe() {
    try{
      const response = await getGraphqlClient().query({
        query: generateQuery({
          me: meFields,
        }),
      });
      me.value = response.data.me;
      return me.value;
    } catch(error) {
      console.info('auth failure', error);
    }
  }

  return {
    me,
    getMe
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot));
}
