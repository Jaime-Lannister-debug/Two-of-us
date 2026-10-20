// 只有这个文件注册功能；模块内部通过 app.actions 调用明确命名的跨模块接口。
import { createShellNavigation } from './shell/navigation.js';
import { createShellEffects } from './shell/effects.js';
import { createAuthController } from './auth/controller.js';
import { createDataItems } from './data/items.js';
import { createCollectionsList } from './collections/list.js';
import { createCollectionsEditor } from './collections/editor.js';
import { createCollectionsProgress } from './collections/progress.js';
import { createCollectionsCalendar } from './collections/calendar.js';
import { createCollectionsTravelMap } from './collections/travel/map.js';
import { createCollectionsTravelEditor } from './collections/travel/editor.js';
import { createCollectionsTravelGallery } from './collections/travel/gallery.js';
import { createCollectionsDetails } from './collections/details.js';
import { createCollectionsMusic } from './collections/music.js';
import { createMediaCovers } from './media/covers.js';
import { createProfilesController } from './profiles/controller.js';
import { createInteractionsRuntime } from './interactions/runtime.js';
import { createInteractionsMilestones } from './interactions/milestones.js';
import { createInteractionsMoods } from './interactions/moods.js';
import { createInteractionsNotifications } from './interactions/notifications.js';
import { createAuthAccountActions } from './auth/account-actions.js';
import { template as template0 } from './collections/editor-template.js';
import { template as template1 } from './profiles/template.js';
import { template as template2 } from './interactions/milestones-template.js';
import { template as template3 } from './interactions/moods-template.js';
import { template as template4 } from './interactions/notifications-template.js';
import { template as template5 } from './collections/details-template.js';

export const featureTemplates = [
  { id: 'modal', html: template0 },
  { id: 'profileModal', html: template1 },
  { id: 'milestoneDialog', html: template2 },
  { id: 'moodDialog', html: template3 },
  { id: 'messageDialog', html: template4 },
  { id: 'photoLightbox', html: template5 },
];

export const featureModules = [
  { id: 'shell/navigation', create: createShellNavigation },
  { id: 'shell/effects', create: createShellEffects },
  { id: 'auth/controller', create: createAuthController },
  { id: 'data/items', create: createDataItems },
  { id: 'collections/list', create: createCollectionsList },
  { id: 'collections/editor', create: createCollectionsEditor },
  { id: 'collections/progress', create: createCollectionsProgress },
  { id: 'collections/calendar', create: createCollectionsCalendar },
  { id: 'collections/travel/map', create: createCollectionsTravelMap },
  { id: 'collections/travel/editor', create: createCollectionsTravelEditor },
  { id: 'collections/travel/gallery', create: createCollectionsTravelGallery },
  { id: 'collections/details', create: createCollectionsDetails },
  { id: 'collections/music', create: createCollectionsMusic },
  { id: 'media/covers', create: createMediaCovers },
  { id: 'profiles/controller', create: createProfilesController },
  { id: 'interactions/runtime', create: createInteractionsRuntime },
  { id: 'interactions/milestones', create: createInteractionsMilestones },
  { id: 'interactions/moods', create: createInteractionsMoods },
  { id: 'interactions/notifications', create: createInteractionsNotifications },
  { id: 'auth/account-actions', create: createAuthAccountActions },
];
