<script setup>
import LocalSettingsHeader from './LocalSettingsHeader.vue';
import PageLayout from '../Shared/PageLayout.vue';
import LocalSettingsGeneral from './LocalSettingsGeneral.vue';
import LocalSettingsByok from './LocalSettingsByok.vue';
import LocalSettingsMenu from './LocalSettingsMenu.vue';
import LocalSettingsDomainFilters from './LocalSettingsDomainFilters.vue';
import useMyComposable from '../../composables/Composable';
const { pageRoute, localSettingsTab } = useMyComposable();
</script>

<template>
  <PageLayout>
    <template #header>
      <LocalSettingsHeader />
    </template>
    <div class="w-full">
      <LocalSettingsGeneral v-if="localSettingsTab === 'general'" />
      <LocalSettingsMenu v-if="localSettingsTab === 'menu'" />
      <LocalSettingsByok v-if="localSettingsTab === 'byok'" />
      <LocalSettingsDomainFilters v-if="localSettingsTab === 'domain-filters'" />
    </div>
  </PageLayout>
</template>
