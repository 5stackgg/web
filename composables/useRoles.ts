import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { e_player_roles_enum } from "~/generated/zeus";

export function useRoles() {
  const { t } = useI18n();

  const roles = computed(() => [
    { value: e_player_roles_enum.user, display: t("roles.user") },
    { value: e_player_roles_enum.verified_user, display: t("roles.verified_user") },
    { value: e_player_roles_enum.streamer, display: t("roles.streamer") },
    { value: e_player_roles_enum.match_organizer, display: t("roles.match_organizer") },
    { value: e_player_roles_enum.tournament_organizer, display: t("roles.tournament_organizer") },
    { value: e_player_roles_enum.administrator, display: t("roles.administrator") },
  ]);

  return { roles };
}
