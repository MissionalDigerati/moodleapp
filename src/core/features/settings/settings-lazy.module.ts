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

import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { conditionalRoutes } from '@/app/app-routing.module';
import { CoreSharedModule } from '@/core/shared.module';
import { CoreScreen } from '@services/screen';

import { CoreSettingsIndexPage } from './pages/index';

const sectionRoutes: Routes = [
    {
        path: 'general',
        loadChildren: () => import('./pages/general/general.module').then(m => m.CoreSettingsGeneralPageModule),
    },
    {
        path: 'spaceusage',
        loadChildren: () => import('./pages/space-usage/space-usage.module').then(m => m.CoreSettingsSpaceUsagePageModule),
    },
    {
        path: 'sync',
        loadChildren: () =>
            import('./pages/synchronization/synchronization.module')
                .then(m => m.CoreSettingsSynchronizationPageModule),
    },
    // @todo sharedfiles
    {
        path: 'about',
        loadChildren: () => import('./pages/about/about.module').then(m => m.CoreSettingsAboutPageModule),
    },
];

const routes: Routes = [
    {
        matcher: segments => {
            const matches = CoreScreen.instance.isMobile ? segments.length === 0 : true;

            return matches ? { consumed: [] } : null;
        },
        component: CoreSettingsIndexPage,
        children: conditionalRoutes([
            {
                path: '',
                pathMatch: 'full',
                redirectTo: 'general',
            },
            ...sectionRoutes,
        ], () => !CoreScreen.instance.isMobile),
    },
    ...conditionalRoutes(sectionRoutes, () => CoreScreen.instance.isMobile),
];

@NgModule({
    imports: [
        RouterModule.forChild(routes),
        CommonModule,
        IonicModule,
        TranslateModule,
        CoreSharedModule,
    ],
    declarations: [
        CoreSettingsIndexPage,
    ],
})
export class CoreSettingsLazyModule {}
