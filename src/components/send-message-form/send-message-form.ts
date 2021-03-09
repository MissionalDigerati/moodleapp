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

import { Component, Input, Output, EventEmitter, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActionSheetController, ActionSheet, Platform } from 'ionic-angular';
import { AndroidPermissions } from '@ionic-native/android-permissions';
import { CoreAppProvider } from '@providers/app';
import { CoreConfigProvider } from '@providers/config';
import { CoreEventsProvider } from '@providers/events';
import { CoreSitesProvider } from '@providers/sites';
import { CoreUtilsProvider } from '@providers/utils/utils';
import { CoreTextUtilsProvider } from '@providers/utils/text';
import { CoreDomUtilsProvider } from '@providers/utils/dom';
import { CoreConstants } from '@core/constants';
import { CoreFileUploaderHelperProvider } from '@core/fileuploader/providers/helper';
import { Sanitizer } from '@classes/sanitizer';
import { take } from 'rxjs/operators';

/**
 * Component to display a "send message form".
 *
 * @description
 * This component will display a standalone send message form in order to have a better UX.
 *
 * Example usage:
 * <core-send-message-form (onSubmit)="sendMessage($event)" [placeholder]="'core.messages.newmessage' | translate"
 * [show-keyboard]="showKeyboard"></core-send-message-form>
 */
@Component({
    selector: 'core-send-message-form',
    templateUrl: 'core-send-message-form.html'
})
export class CoreSendMessageFormComponent implements OnInit {
    @Input() message: string; // Input text.
    @Input() placeholder = ''; // Placeholder for the input area.
    @Input() showKeyboard = false; // If keyboard is shown or not.
    @Input() sendDisabled = false; // If send is disabled.
    @Output() onSubmit: EventEmitter<string>; // Send data when submitting the message form.
    @Output() onResize: EventEmitter<void>; // Emit when resizing the textarea.

    @ViewChild('messageForm') formElement: ElementRef;
    /**
     * Can we use the camera?
     */
    canUseCamera = false;
    /**
     * Can we use the video recorder?
     */
    canUseVideo = false;
    /**
     * Can we get an attachment?
     */
    canGetAttachment = false;

    protected sendOnEnter: boolean;
    /**
     * Our actionsheet for photo picking
     */
    protected actionSheet: ActionSheet;

    constructor(protected utils: CoreUtilsProvider,
            protected textUtils: CoreTextUtilsProvider,
            configProvider: CoreConfigProvider,
            protected eventsProvider: CoreEventsProvider,
            protected sitesProvider: CoreSitesProvider,
            protected appProvider: CoreAppProvider,
            protected domUtils: CoreDomUtilsProvider,
            protected fileUploaderHelper: CoreFileUploaderHelperProvider,
            protected http: HttpClient,
            protected actionSheetCtrl: ActionSheetController,
            protected androidPermissions: AndroidPermissions,
            protected platform: Platform) {

        this.onSubmit = new EventEmitter();
        this.onResize = new EventEmitter();

        configProvider.get(CoreConstants.SETTINGS_SEND_ON_ENTER, !this.appProvider.isMobile()).then((sendOnEnter) => {
            this.sendOnEnter = !!sendOnEnter;
        });

        eventsProvider.on(CoreEventsProvider.SEND_ON_ENTER_CHANGED, (newValue) => {
            this.sendOnEnter = newValue;
        }, sitesProvider.getCurrentSiteId());

        this.canUseCamera = this.fileUploaderHelper.isHandlerEnabled('CoreFileUploaderCamera');
        this.canUseVideo = this.fileUploaderHelper.isHandlerEnabled('CoreFileUploaderVideo');
        this.canGetAttachment = this.fileUploaderHelper.isHandlerEnabled('CoreFileUploaderFile');
    }

    ngOnInit(): void {
        this.showKeyboard = this.utils.isTrueOrOne(this.showKeyboard);
    }

    /**
     * Pick whether to use the camera or the album?
     *
     * @param $event The event that triggered this.
     *
     */
    pickAttachment($event: Event): void {
        this.checkPermission(this.androidPermissions.PERMISSION.READ_EXTERNAL_STORAGE).then((result: boolean) => {
            if (result) {
                this.addAttachment('document', $event);
            }
        });
    }

    /**
     * Pick whether to use the camera or the album?
     *
     * @param $event The event that triggered this.
     *
     */
    pickPhoto($event: Event): void {
        $event.preventDefault();
        $event.stopPropagation();
        this.actionSheet = this.actionSheetCtrl.create({
            title: '',
            cssClass: 'photo-picker-action',
            buttons: [
                {
                    text: '',
                    icon: 'camera',
                    cssClass: 'side-by-side',
                    handler: (): boolean => {
                        this.addAttachment('photo', null);

                        return true;
                    }
                },
                {
                    text: '',
                    icon: 'images',
                    cssClass: 'side-by-side',
                    handler: (): boolean => {
                        this.addAttachment('album', null);

                        return true;
                    }
                }
            ]
        });
        this.checkPermission(this.androidPermissions.PERMISSION.CAMERA).then((result: boolean) => {
            if (result) {
                this.checkPermission(this.androidPermissions.PERMISSION.READ_EXTERNAL_STORAGE).then((result: boolean) => {
                    if (result) {
                        this.actionSheet.present();
                    }
                });
            }
        });
    }

    /**
     * We want to pick a video file.
     *
     * @param $event The event that triggered this.
     */
    pickVideo($event: Event): void {
        this.checkPermission(this.androidPermissions.PERMISSION.CAMERA).then((result: boolean) => {
            if (result) {
                this.checkPermission(this.androidPermissions.PERMISSION.READ_EXTERNAL_STORAGE).then((result: boolean) => {
                    if (result) {
                        this.addAttachment('video', $event);
                    }
                });
            }
        });
    }

    /**
     * Ad an attachment to the chat. Chat messages will be
     * <attachment type="video" id="moodleFileID">
     *
     * @param   mediaType   The type of media to attach (audio, document, photo, video)
     * @param   $event      Event that triggered it.
     * @return  void
     */
    addAttachment(mediaType: string, $event: Event): void {
        if ($event) {
            $event.preventDefault();
            $event.stopPropagation();
        }
        if (this.actionSheet) {
            this.actionSheet.dismiss();
            this.actionSheet = null;
        }
        let handlerName = '';
        switch (mediaType) {
            case 'album':
                handlerName = 'CoreFileUploaderAlbum';
                break;
            case 'audio':
                handlerName = 'CoreFileUploaderAudio';
                break;
            case 'document':
                handlerName = 'CoreFileUploaderFile';
                break;
            case 'photo':
                handlerName = 'CoreFileUploaderCamera';
                break;
            case 'video':
                handlerName = 'CoreFileUploaderVideo';
                break;
            default:
                handlerName = '';
                break;
        }
        if (handlerName === '') {

            return;
        }
        this.fileUploaderHelper.triggerHandlerActionByName(
            handlerName,
            -1,
            true,
            false,
            []
        ).then((result) => {
            if (!('itemid' in result)) {
                return;
            }
            const content = Sanitizer.encodeHTML(
                `<attachment type="${mediaType}" id="${result.itemid}" filepath="${result.filepath}" filename="${result.filename}">`
            );

            return this.sitesProvider.getSite().then((site) => {
                const url = `${site.siteUrl}/local/chat_attachments/api.php`;
                const headers = {
                    headers: {
                        'content-type': 'application/json'
                    }
                };
                const params = {
                    token: site.token,
                    method: 'add_file',
                    item_id: result.itemid,
                };
                this.http.post(url, params, headers).pipe(take(1)).subscribe(() => {
                    this.onSubmit.emit(content);
                });
            });
        });
    }

    protected checkPermission(permission: any): Promise<any> {
        if (!this.platform.is('android')) {

            return Promise.resolve(true);
        }

        return this.androidPermissions.checkPermission(permission).then((result: any) => {
            if (result.hasPermission) {

                return Promise.resolve(true);
            }

            return this.androidPermissions.requestPermission(permission).then((reqResult: any) => {

                return Promise.resolve(reqResult.hasPermission);
            });
        });
    }

    /**
     * Returns an empty string if we should shrink the text area, otherwise returns null
     *
     * @return an empty string or null
     */
    get whenShrunk(): string | null {
        return ((!this.message) && (this.canUseCamera || this.canUseVideo || this.canGetAttachment)) ? '' : null;
    }

    /**
     * Returns an empty string if we should stretch the text area, otherwise returns null
     *
     * @return an empty string or null
     */
    get whenStretched(): string | null {
        return ((this.message) || ((!this.canUseCamera) && (!this.canUseVideo) && (!this.canGetAttachment))) ? '' : null;
    }

    /**
     * Form submitted.
     *
     * @param $event Mouse event.
     */
    submitForm($event: Event): void {
        $event.preventDefault();
        $event.stopPropagation();

        let value = this.message.trim();

        if (!value) {
            // Silent error.
            return;
        }

        this.message = ''; // Reset the form.

        this.domUtils.triggerFormSubmittedEvent(this.formElement, false, this.sitesProvider.getCurrentSiteId());

        value = this.textUtils.replaceNewLines(value, '<br>');
        this.onSubmit.emit(value);
    }

    /**
     * Textarea resized.
     */
    textareaResized(): void {
        this.onResize.emit();
    }

    /**
     * Enter key clicked.
     *
     * @param e Event.
     * @param other The name of the other key that was clicked, undefined if no other key.
     */
    enterClicked(e: Event, other: string): void {
        if (this.sendDisabled) {
            return;
        }

        if (this.sendOnEnter && !other) {
            // Enter clicked, send the message.
            this.submitForm(e);
        } else if (!this.sendOnEnter && !this.appProvider.isMobile()) {
            if ((this.appProvider.isMac() && other == 'meta') || (!this.appProvider.isMac() && other == 'control')) {
                // Cmd+Enter or Ctrl+Enter, send message.
                this.submitForm(e);
            }
        }
    }
}
