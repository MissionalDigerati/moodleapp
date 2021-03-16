// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { IonicPage, Platform, NavController, NavParams, Content } from 'ionic-angular';
import { TranslateService } from '@ngx-translate/core';
import { CoreEventsProvider } from '@providers/events';
import { CoreSitesProvider } from '@providers/sites';
import {
    AddonMessagesProvider, AddonMessagesConversationFormatted, AddonMessagesConversationMessage
} from '../../providers/messages';
import { AddonMessagesOfflineProvider } from '../../providers/messages-offline';
import { CoreDomUtilsProvider } from '@providers/utils/dom';
import { CoreUtilsProvider } from '@providers/utils/utils';
import { CorePushNotificationsDelegate } from '@core/pushnotifications/providers/delegate';
import { CoreSplitViewComponent } from '@components/split-view/split-view';
import { CoreUserProvider } from '@core/user/providers/user';

/**
 * Page that displays the list of conversations, including group conversations.
 */
@IonicPage({ segment: 'addon-messages-group-conversations' })
@Component({
    selector: 'page-addon-messages-group-conversations',
    templateUrl: 'group-conversations.html',
})
export class AddonMessagesGroupConversationsPage implements OnInit, OnDestroy {
    @ViewChild(CoreSplitViewComponent) splitviewCtrl: CoreSplitViewComponent;
    @ViewChild(Content) content: Content;
    @ViewChild('messageList') messageListEl: ElementRef;

    loaded = false;
    loadingMessage: string;
    selectedConversationId: number;
    selectedUserId: number;
    contactRequestsCount = 0;
    /**
     * Settings to get all messages
     */
    all: AddonMessagesGroupConversationOption = {
        type: null,
        favourites: null,
        count: 0,
        unread: 0,
    };
    /**
     * Settings to get favorite messages
     */
    favourites: AddonMessagesGroupConversationOption = {
        type: null,
        favourites: true,
        count: 0,
        unread: 0,
    };
    /**
     * Indicates what type is the group type for appropriate display of the avatar
     */
    typeGroup = AddonMessagesProvider.MESSAGE_CONVERSATION_TYPE_GROUP;

    protected loadingString: string;
    protected siteId: string;
    protected currentUserId: number;
    protected conversationId: number;
    protected discussionUserId: number;
    protected newMessagesObserver: any;
    protected pushObserver: any;
    protected appResumeSubscription: any;
    protected readChangedObserver: any;
    protected cronObserver: any;
    protected openConversationObserver: any;
    protected updateConversationListObserver: any;
    protected contactRequestsCountObserver: any;
    protected memberInfoObserver: any;

    constructor(eventsProvider: CoreEventsProvider, sitesProvider: CoreSitesProvider, translate: TranslateService,
            private messagesProvider: AddonMessagesProvider, private domUtils: CoreDomUtilsProvider, navParams: NavParams,
            private navCtrl: NavController, platform: Platform, private utils: CoreUtilsProvider,
            pushNotificationsDelegate: CorePushNotificationsDelegate, private messagesOffline: AddonMessagesOfflineProvider,
            private userProvider: CoreUserProvider) {

        this.loadingString = translate.instant('core.loading');
        this.siteId = sitesProvider.getCurrentSiteId();
        this.currentUserId = sitesProvider.getCurrentSiteUserId();
        // Conversation to load.
        this.conversationId = navParams.get('conversationId') || false;
        this.discussionUserId = !this.conversationId && (navParams.get('discussionUserId') || false);

        // Update conversations when new message is received.
        this.newMessagesObserver = eventsProvider.on(AddonMessagesProvider.NEW_MESSAGE_EVENT, (data) => {
            // Search the conversation to update.
            const conversation = this.findConversation(data.conversationId, data.userId);

            if (typeof conversation == 'undefined') {
                // Probably a new conversation, refresh the list.
                this.loaded = false;
                this.refreshData().finally(() => {
                    this.loaded = true;
                });
            } else if (conversation.lastmessage != data.message || conversation.lastmessagedate != data.timecreated / 1000) {
                const isNewer = data.timecreated / 1000 > conversation.lastmessagedate;

                // An existing conversation has a new message, update the last message.
                conversation.lastmessage = data.message;
                conversation.lastmessagedate = data.timecreated / 1000;

                // Sort the affected list.
                this.all.conversations = this.messagesProvider.sortConversations(this.all.conversations);

                if (isNewer) {
                    // The last message is newer than the previous one, scroll to top to keep viewing the conversation.
                    this.domUtils.scrollToTop(this.content);
                }
            }
        }, this.siteId);

        // Update conversations when a message is read.
        this.readChangedObserver = eventsProvider.on(AddonMessagesProvider.READ_CHANGED_EVENT, (data) => {
            if (data.conversationId) {
                const conversation = this.findConversation(data.conversationId);

                if (typeof conversation != 'undefined') {
                    // A conversation has been read reset counter.
                    conversation.unreadcount = 0;

                    // Conversations changed, invalidate them and refresh unread counts.
                    this.messagesProvider.invalidateConversations(this.siteId);
                    this.messagesProvider.refreshUnreadConversationCounts(this.siteId);
                }
            }
        }, this.siteId);

        // Load a discussion if we receive an event to do so.
        this.openConversationObserver = eventsProvider.on(AddonMessagesProvider.OPEN_CONVERSATION_EVENT, (data) => {
            if (data.conversationId || data.userId) {
                this.gotoConversation(data.conversationId, data.userId);
            }
        }, this.siteId);

        // Refresh the view when the app is resumed.
        this.appResumeSubscription = platform.resume.subscribe(() => {
            if (!this.loaded) {
                return;
            }
            this.loaded = false;
            this.refreshData().finally(() => {
                this.loaded = true;
            });
        });

        // Update conversations if we receive an event to do so.
        this.updateConversationListObserver = eventsProvider.on(AddonMessagesProvider.UPDATE_CONVERSATION_LIST_EVENT, (data) => {
            if (data && data.action == 'mute') {
                // If the conversation is displayed, change its muted value.
                const conversation = this.findConversation(data.conversationId);
                if (conversation) {
                    conversation.ismuted = data.value;
                }

                return;
            }

            this.refreshData();

        }, this.siteId);

        // If a message push notification is received, refresh the view.
        this.pushObserver = pushNotificationsDelegate.on('receive').subscribe((notification) => {
            // New message received. If it's from current site, refresh the data.
            if (utils.isFalseOrZero(notification.notif) && notification.site == this.siteId) {
                // Don't refresh unread counts, it's refreshed from the main menu handler in this case.
                this.refreshData();
            }
        });

        // Update the contact requests badge.
        this.contactRequestsCountObserver = eventsProvider.on(AddonMessagesProvider.CONTACT_REQUESTS_COUNT_EVENT, (data) => {
            this.contactRequestsCount = data.count;
        }, this.siteId);

        // Update block status of a user.
        this.memberInfoObserver = eventsProvider.on(AddonMessagesProvider.MEMBER_INFO_CHANGED_EVENT, (data) => {
            if (!data.userBlocked && !data.userUnblocked) {
                // The block status has not changed, ignore.
                return;
            }
            // Block the user message if not a group message
            const conversation = this.findConversation(undefined, data.userId);
            if ((conversation) && (conversation.type !== AddonMessagesProvider.MESSAGE_CONVERSATION_TYPE_GROUP)) {
                conversation.isblocked = data.userBlocked;
            }
        }, this.siteId);
    }

    /**
     * Component loaded.
     */
    ngOnInit(): void {
        if (this.conversationId || this.discussionUserId) {
            // There is a discussion to load, open the discussion in a new state.
            this.gotoConversation(this.conversationId, this.discussionUserId);
        }

        this.fetchData().then(() => {
            if (!this.conversationId && !this.discussionUserId && this.splitviewCtrl.isOn() && this.all.conversations.length > 0) {
                // Load the first conversation.
                const  conversation = this.all.conversations[0];
                this.gotoConversation(conversation.id);
            }
        });
    }

    /**
     * Fetch conversations.
     *
     * @return Promise resolved when done.
     */
    protected fetchData(): Promise<any> {
        this.loadingMessage = this.loadingString;

        return this.fetchDataForOption(this.all, false).catch((error) => {
            this.domUtils.showErrorModalDefault(error, 'addon.messages.errorwhileretrievingdiscussions', true);
        }).finally(() => {
            this.loaded = true;
        });
    }

    /**
     * Fetch data for a certain option.
     *
     * @param option The option to fetch data for.
     * @param loadingMore Whether we are loading more data or just the first ones.
     * @return Promise resolved when done.
     */
    fetchDataForOption(option: AddonMessagesGroupConversationOption, loadingMore?: boolean): Promise<void> {
        option.loadMoreError = false;

        const limitFrom = loadingMore ? option.conversations.length : 0,
            promises = [];
        let data: {conversations: AddonMessagesConversationForList[], canLoadMore: boolean},
            offlineMessages;

        // Get the conversations and, if needed, the offline messages. Always try to get the latest data.
        promises.push(this.messagesProvider.invalidateConversations(this.siteId).catch(() => {
            // Shouldn't happen.
        }).then(() => {
            return this.messagesProvider.getConversations(option.type, option.favourites, limitFrom, this.siteId);
        }).then((result) => {
            data = result;
        }));

        if (!loadingMore) {
            promises.push(this.messagesOffline.getAllMessages().then((data) => {
                offlineMessages = data;
            }));
        }

        return Promise.all(promises).then(() => {
            if (loadingMore) {
                option.conversations = option.conversations.concat(data.conversations);
                option.canLoadMore = data.canLoadMore;
            } else {
                option.conversations = data.conversations;
                option.canLoadMore = data.canLoadMore;

                if (offlineMessages && offlineMessages.length) {
                    return this.loadOfflineMessages(offlineMessages).then(() => {
                        // Sort the conversations, the offline messages could affect the order.
                        option.conversations = this.messagesProvider.sortConversations(option.conversations);
                    });
                }
            }
        });
    }

    /**
     * Find a conversation in the list of loaded conversations.
     *
     * @param conversationId The conversation ID to search.
     * @param userId User ID to search (if no conversationId).
     * @param option The option to search in. If not defined, search in all options.
     * @return Conversation.
     */
    protected findConversation(conversationId: number, userId?: number, option?: AddonMessagesGroupConversationOption)
            : AddonMessagesConversationForList {

        const conversations = option ? (option.conversations || []) : (this.all.conversations || []);

        return conversations.find((conv) => {
            if (conversationId) {
                return conv.id == conversationId;
            } else {
                return conv.userid == userId;
            }
        });
    }

    /**
     * Navigate to contacts view.
     */
    gotoContacts(): void {
        this.splitviewCtrl.getMasterNav().push('AddonMessagesContactsPage');
    }

    /**
     * Navigate to a particular conversation.
     *
     * @param conversationId Conversation Id to load.
     * @param userId User of the conversation. Only if there is no conversationId.
     * @param messageId Message to scroll after loading the discussion. Used when searching.
     */
    gotoConversation(conversationId: number, userId?: number, messageId?: number): void {
        this.selectedConversationId = conversationId;
        this.selectedUserId = userId;

        const params = {
            conversationId: conversationId,
            userId: userId
        };
        if (messageId) {
            params['message'] = messageId;
        }
        this.splitviewCtrl.push('AddonMessagesDiscussionPage', params);
    }

    /**
     * Navigate to message settings.
     */
    gotoSettings(): void {
        this.splitviewCtrl.push('AddonMessagesSettingsPage');
    }

    /**
     * Function to load more conversations.
     *
     * @param option The option to fetch data for.
     * @param infiniteComplete Infinite scroll complete function. Only used from core-infinite-loading.
     * @return Promise resolved when done.
     */
    loadMoreConversations(option: AddonMessagesGroupConversationOption, infiniteComplete?: any): Promise<void> {
        return this.fetchDataForOption(option, true).catch((error) => {
            this.domUtils.showErrorModalDefault(error, 'addon.messages.errorwhileretrievingdiscussions', true);
            option.loadMoreError = true;
        }).finally(() => {
            infiniteComplete && infiniteComplete();
        });
    }

    /**
     * Load offline messages into the conversations.
     *
     * @param messages Offline messages.
     * @return Promise resolved when done.
     */
    protected loadOfflineMessages(messages: any[]): Promise<any> {
        const promises = [];

        messages.forEach((message) => {
            if (message.conversationid) {
                // It's an existing conversation. Search for it.
                let conversation = this.findConversation(message.conversationid, undefined);

                if (conversation) {
                    // Check if it's the last message. Offline messages are considered more recent than sent messages.
                    if (typeof conversation.lastmessage === 'undefined' || conversation.lastmessage === null ||
                            !conversation.lastmessagepending || conversation.lastmessagedate <= message.timecreated / 1000) {

                        this.addLastOfflineMessage(conversation, message);
                    }
                } else {
                    // Conversation not found, it could be an old one or the message could belong to another option.
                    conversation = message.conversation || {};
                    conversation.id = message.conversationid;
                    this.addLastOfflineMessage(conversation, message);
                    this.addOfflineConversation(conversation);
                }
            } else {
                // It's a new conversation. Check if we already created it (there is more than one message for the same user).
                const conversation = this.findConversation(undefined, message.touserid);
                if (conversation.type !== AddonMessagesProvider.MESSAGE_CONVERSATION_TYPE_INDIVIDUAL) {
                    // Only do this on individual messages
                    return;
                }
                message.text = message.smallmessage;

                if (conversation) {
                    // Check if it's the last message. Offline messages are considered more recent than sent messages.
                    if (conversation.lastmessagedate <= message.timecreated / 1000) {
                        this.addLastOfflineMessage(conversation, message);
                    }
                } else {
                    // Get the user data and create a new conversation if it belongs to the current option.
                    promises.push(this.userProvider.getProfile(message.touserid, undefined, true).catch(() => {
                        // User not found.
                    }).then((user) => {
                        const conversation = {
                            userid: message.touserid,
                            name: user ? user.fullname : String(message.touserid),
                            imageurl: user ? user.profileimageurl : '',
                            type: AddonMessagesProvider.MESSAGE_CONVERSATION_TYPE_INDIVIDUAL
                        };

                        this.addLastOfflineMessage(conversation, message);
                        this.addOfflineConversation(conversation);
                    }));
                }
            }
        });

        return Promise.all(promises);
    }

    /**
     * Add an offline conversation into the right list of conversations.
     *
     * @param conversation Offline conversation to add.
     */
    protected addOfflineConversation(conversation: any): void {
        this.all.conversations.unshift(conversation);
    }

    /**
     * Add a last offline message into a conversation.
     *
     * @param conversation Conversation where to put the last message.
     * @param message Offline message to add.
     */
    protected addLastOfflineMessage(conversation: any, message: AddonMessagesConversationMessage): void {
        conversation.lastmessage = message.text;
        conversation.lastmessagedate = message.timecreated / 1000;
        conversation.lastmessagepending = true;
        conversation.sentfromcurrentuser = true;
    }

    /**
     * Refresh the data.
     *
     * @param refresher Refresher.
     * @return Promise resolved when done.
     */
    refreshData(refresher?: any): Promise<void> {
        // Don't invalidate conversations and so, they always try to get latest data.
        const promises = [
            this.messagesProvider.invalidateContactRequestsCountCache(this.siteId)
        ];

        return this.utils.allPromises(promises).finally(() => {
            return this.fetchData().finally(() => {
                if (refresher) {
                    refresher.complete();
                }
            });
        });
    }

    /**
     * Navigate to the search page.
     */
    gotoSearch(): void {
        this.navCtrl.push('AddonMessagesSearchPage');
    }

    /**
     * Page destroyed.
     */
    ngOnDestroy(): void {
        this.newMessagesObserver && this.newMessagesObserver.off();
        this.appResumeSubscription && this.appResumeSubscription.unsubscribe();
        this.pushObserver && this.pushObserver.unsubscribe();
        this.readChangedObserver && this.readChangedObserver.off();
        this.cronObserver && this.cronObserver.off();
        this.openConversationObserver && this.openConversationObserver.off();
        this.updateConversationListObserver && this.updateConversationListObserver.off();
        this.contactRequestsCountObserver && this.contactRequestsCountObserver.off();
        this.memberInfoObserver && this.memberInfoObserver.off();
    }
}

/**
 * Conversation options.
 */
export type AddonMessagesGroupConversationOption = {
    type: number; // Option type.
    favourites: boolean; // Whether it contains favourites conversations.
    count: number; // Number of conversations.
    unread?: number; // Number of unread conversations.
    expanded?: boolean; // Whether the option is currently expanded.
    loading?: boolean; // Whether the option is being loaded.
    canLoadMore?: boolean; // Whether it can load more data.
    loadMoreError?: boolean; // Whether there was an error loading more conversations.
    conversations?: AddonMessagesConversationForList[]; // List of conversations.
};

/**
 * Formatted conversation with some calculated data for the list.
 */
export type AddonMessagesConversationForList = AddonMessagesConversationFormatted & {
    lastmessagepending?: boolean; // Calculated in the app. Whether last message is pending to be sent.
};
