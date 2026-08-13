<script setup>
import VoicesHeader from './VoicesHeader.vue';
import PageLayout from '../Shared/PageLayout.vue';
import useMyComposable from '../../composables/Composable';
import PremiumVoicesList from './Premium/PremiumVoicesList.vue';
import FavoriteVoicesList from './Premium/FavoriteVoicesList.vue';
import CollectionVoicesList from './Premium/CollectionVoicesList.vue';
import PaginationControls from './Footer/PaginationControls.vue';
import VoicesApiKeyAlert from './VoicesApiKeyAlert.vue';
const { voiceSwitchOnPremium , voiceShowFavoritesOn, voiceShowCollectionsOn } = useMyComposable();
</script>

<template>
  <PageLayout>
    <template #header>
      <VoicesHeader />
    </template>
    <div class="overflow-y-scroll scrollbar-thin relative flex flex-col h-full">
      <VoicesApiKeyAlert />
      <CollectionVoicesList v-if="voiceShowCollectionsOn" />
      <FavoriteVoicesList v-else-if="voiceShowFavoritesOn" />
      <div class="px-4 flex-grow" v-else-if="voiceSwitchOnPremium"><PremiumVoicesList /></div>
      
      <div v-if="voiceSwitchOnPremium && !voiceShowFavoritesOn && !voiceShowCollectionsOn" class="sticky bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 py-3 flex justify-center z-10">
        <PaginationControls />
      </div>
    </div>
  </PageLayout>
</template>
