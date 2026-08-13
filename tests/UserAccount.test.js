import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import UserAccount from '../src/components/Account/UserAccount.vue';

const isUserLoggedRef = ref(true);
const userProfileRef = ref({ username: 'testuser' });

// Mock composables & helpers
vi.mock('../src/composables/Composable', () => ({
    default: () => ({
        sortByDomainsList: ref([]),
        pageRoute: ref('account'),
        API_NUXT_DOMAIN: ref('voicerankings.com'),
        isUserLogged: isUserLoggedRef,
        userProfile: userProfileRef,
        getUserStatus: vi.fn()
    })
}));

vi.mock('../js/utils/helpers', () => ({
    readLocalStorage: vi.fn(() => Promise.resolve({})),
    saveToLocalStorage: vi.fn(() => Promise.resolve())
}));

global.chrome = {
    runtime: {
        sendMessage: vi.fn()
    }
};

describe('UserAccount.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isUserLoggedRef.value = true;
        userProfileRef.value = { username: 'testuser' };
    });

    it('renders user account details and username correctly', () => {
        const wrapper = mount(UserAccount, {
            global: {
                directives: { tooltip: () => {} },
                stubs: {
                    PageLayout: { template: '<div><slot /><slot name="header" /></div>' },
                    PageHeader: true,
                    ModalFull: true,
                    ChangeUsernameModal: true
                }
            }
        });

        const text = wrapper.text();
        expect(text).toContain('Username');
        expect(text).toContain('testuser');
        expect(text).toContain('Change username');
        expect(text).toContain('Delete account');
    });

    it('opens account deletion modal when clicking Delete account', async () => {
        const wrapper = mount(UserAccount, {
            global: {
                directives: { tooltip: () => {} },
                stubs: {
                    PageLayout: { template: '<div><slot /><slot name="header" /></div>' },
                    PageHeader: true,
                    ModalFull: true,
                    ChangeUsernameModal: true
                }
            }
        });

        const deleteButton = wrapper.findAll('button').find(b => b.text().includes('Delete account'));
        expect(deleteButton).toBeDefined();

        await deleteButton.trigger('click');
        expect(wrapper.vm.isShow).toBe(true);
    });
});
