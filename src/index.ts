import { NgModule, Injectable } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ToolbarButtonProvider, ConfigProvider } from 'tabby-core'

import { ButtonBarComponent } from './components/buttonBar.component'
import { ButtonBarService } from './services/buttonBar.service'

/**
 * Toolbar button provider for toggling the button bar.
 *
 * @Injectable() is required: Angular's JIT DI needs the design:paramtypes
 * metadata that TypeScript only emits for decorated classes. Without it the
 * provider cannot be constructed (NG0204) and the toolbar toggle silently
 * never works.
 */
@Injectable()
export class ButtonBarToolbarButtonProvider extends ToolbarButtonProvider {
    constructor(private buttonBarService: ButtonBarService) {
        super()
    }

    provide() {
        return [
            {
                icon: '<i class="fas fa-keyboard"></i>',
                title: 'Toggle Button Bar',
                touchBarTitle: 'Button Bar',
                weight: -10,
                click: () => {
                    this.buttonBarService.toggle()
                },
            },
        ]
    }
}

/**
 * Config provider for default plugin settings
 */
export class ButtonBarConfigProvider extends ConfigProvider {
    defaults = {
        pluginConfig: {
            'button-bar': {
                barVisible: true,
                lists: [],
                activeListId: '',
            },
        },
    }
}

@NgModule({
    imports: [CommonModule, FormsModule],
    declarations: [ButtonBarComponent],
    exports: [ButtonBarComponent],
    providers: [
        ButtonBarService,
        { provide: ToolbarButtonProvider, useClass: ButtonBarToolbarButtonProvider, multi: true },
        { provide: ConfigProvider, useClass: ButtonBarConfigProvider, multi: true },
    ],
})
export class ButtonBarModule {
    constructor(private buttonBarService: ButtonBarService) {
        // Initialize the button bar on app start
        setTimeout(() => {
            this.buttonBarService.initialize()
        }, 500)
    }

    static forRoot() {
        return {
            ngModule: ButtonBarModule,
            providers: [],
        }
    }
}

export default ButtonBarModule

export { ButtonBarComponent } from './components/buttonBar.component'
export { ButtonBarService } from './services/buttonBar.service'
